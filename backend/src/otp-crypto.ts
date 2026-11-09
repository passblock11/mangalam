import { env } from "./env.js";

function pepper(): string {
  return env("OTP_PEPPER") ?? env("SUPABASE_JWT_SECRET") ?? "dev-only-pepper";
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export async function hashOtp(phoneE164: string, otp: string): Promise<string> {
  return sha256Hex(`${pepper()}|${phoneE164}|${otp}`);
}

export function generateOtp(length: number): string {
  const digits = "0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += digits[bytes[i]! % 10];
  }
  return out;
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
