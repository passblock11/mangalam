import { env } from "./env.js";

const PREFIX = "mgc1:";

let cached: CryptoKey | null = null;

function webCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error("Web Crypto is not available");
  return c;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** 32-byte AES key. A dedicated env key wins; otherwise the service role is hashed. */
async function chatKey(): Promise<CryptoKey> {
  if (cached) return cached;
  const explicit = env("CHAT_ENCRYPTION_KEY")?.trim();
  let raw: Uint8Array;
  if (explicit) {
    raw = base64ToBytes(explicit);
    if (raw.length !== 32) throw new Error("CHAT_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  } else {
    const secret = env("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!secret) throw new Error("Chat encryption key is not configured");
    const digest = await webCrypto().subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`mangalam-chat-v1:${secret}`)
    );
    raw = new Uint8Array(digest);
  }
  const copy = new Uint8Array(raw.byteLength);
  copy.set(raw);
  cached = await webCrypto().subtle.importKey("raw", copy, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
  return cached;
}

export function isEncryptedMessage(body: string): boolean {
  return body.startsWith(PREFIX);
}

export async function encryptMessage(plain: string): Promise<string> {
  const iv = webCrypto().getRandomValues(new Uint8Array(12));
  const key = await chatKey();
  const cipher = new Uint8Array(
    await webCrypto().subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plain)
    )
  );
  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv, 0);
  packed.set(cipher, iv.length);
  return PREFIX + bytesToBase64(packed);
}

export async function decryptMessage(stored: string): Promise<string> {
  if (!isEncryptedMessage(stored)) return stored;
  const packed = base64ToBytes(stored.slice(PREFIX.length));
  if (packed.length < 13) throw new Error("Bad message");
  const iv = packed.slice(0, 12);
  const cipher = packed.slice(12);
  const key = await chatKey();
  const plain = await webCrypto().subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
}
