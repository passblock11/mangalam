import { env } from "./env.js";

/**
 * Optional AES-256-GCM envelope for the mobile app.
 *
 * Requests without `X-Mangalam-Enc: 1` are left untouched, so the admin
 * panel, Razorpay webhooks, and already-installed builds keep working.
 *
 * Sealed bytes: ASCII "mg1" + 12-byte IV + ciphertext (tag is the last 16 bytes).
 * Query values travel in `X-Mangalam-Q` as base64url of those same bytes.
 */

const MAGIC = [0x6d, 0x67, 0x31] as const;

let cachedRaw = "";
let cachedKey: CryptoKey | null = null;

export function payloadExempt(path: string): boolean {
  return path.endsWith("/html") || path.includes("/razorpay/webhook");
}

export function payloadKeyConfigured(): boolean {
  const raw = env("API_PAYLOAD_KEY")?.trim() ?? "";
  if (!raw) return false;
  try {
    return b64ToBytes(raw).length === 32;
  } catch {
    return false;
  }
}

export function looksSealed(bytes: Uint8Array): boolean {
  return bytes.length >= MAGIC.length && bytes[0] === MAGIC[0] && bytes[1] === MAGIC[1] && bytes[2] === MAGIC[2];
}

export function isSealed(bytes: Uint8Array): boolean {
  return (
    bytes.length >= MAGIC.length + 12 + 16 &&
    bytes[0] === MAGIC[0] &&
    bytes[1] === MAGIC[1] &&
    bytes[2] === MAGIC[2]
  );
}

export async function sealBytes(plain: string, nonce?: Uint8Array): Promise<Uint8Array> {
  const key = await aesKey();
  if (!key) throw new Error("payload key missing");
  const iv = nonce ?? crypto.getRandomValues(new Uint8Array(12));
  if (iv.length !== 12) throw new Error("payload iv");
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asBuffer(iv), tagLength: 128 },
    key,
    asBuffer(new TextEncoder().encode(plain)),
  );
  const ct = new Uint8Array(cipher);
  const out = new Uint8Array(MAGIC.length + iv.length + ct.length);
  out.set(MAGIC, 0);
  out.set(iv, MAGIC.length);
  out.set(ct, MAGIC.length + iv.length);
  return out;
}

export async function openBytes(bytes: Uint8Array): Promise<string> {
  if (!isSealed(bytes)) throw new Error("payload envelope");
  const key = await aesKey();
  if (!key) throw new Error("payload key missing");
  const iv = bytes.subarray(MAGIC.length, MAGIC.length + 12);
  const ct = bytes.subarray(MAGIC.length + 12);
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asBuffer(iv), tagLength: 128 },
    key,
    asBuffer(ct),
  );
  return new TextDecoder().decode(clear);
}

export async function sealHeader(plain: string): Promise<string> {
  return bytesToB64url(await sealBytes(plain));
}

export async function openHeader(value: string): Promise<string> {
  return openBytes(b64urlToBytes(value.trim()));
}

async function aesKey(): Promise<CryptoKey | null> {
  const raw = env("API_PAYLOAD_KEY")?.trim() ?? "";
  if (!raw) return null;
  if (cachedKey && cachedRaw === raw) return cachedKey;
  let bytes: Uint8Array;
  try {
    bytes = b64ToBytes(raw);
  } catch {
    return null;
  }
  if (bytes.length !== 32) return null;
  cachedKey = await crypto.subtle.importKey(
    "raw",
    asBuffer(bytes),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  cachedRaw = raw;
  return cachedKey;
}

function asBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesToB64url(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = Array.from(bytes.subarray(i, i + chunk));
    binary += String.fromCharCode.apply(null, slice);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64ToBytes(value: string): Uint8Array {
  return b64urlToBytes(value.replace(/\+/g, "-").replace(/\//g, "_"));
}

function b64urlToBytes(value: string): Uint8Array {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
