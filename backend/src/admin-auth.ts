import { createMiddleware } from "hono/factory";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "./env.js";
import { getSupabaseAdmin } from "./supabase.js";

// ─────────────────────────────────────────────────────────────────────────────
// Canonical admin feature permissions
// ─────────────────────────────────────────────────────────────────────────────
export const ADMIN_FEATURES = [
  "overview",
  "verifications",
  "users",
  "reports",
  "payments",
  "settings",
  "admins",
  "support",
] as const;

export type AdminFeature = (typeof ADMIN_FEATURES)[number];

export type AdminPermissions = Partial<Record<AdminFeature, boolean>>;

export type AdminRow = {
  id: string;
  email: string;
  full_name: string | null;
  permissions: AdminPermissions;
  is_active: boolean;
  is_super_admin: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminTokenPayload = JWTPayload & {
  sub: string;
  email: string;
  permissions: AdminPermissions;
  is_super_admin: boolean;
};

declare module "hono" {
  interface ContextVariableMap {
    admin: AdminRow;
    adminFeature: AdminFeature | null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT helpers (HS256)
// ─────────────────────────────────────────────────────────────────────────────
function getAdminJwtSecret(): Uint8Array {
  const raw = env("ADMIN_JWT_SECRET");
  if (!raw) {
    throw new Error("ADMIN_JWT_SECRET is not set on the backend");
  }
  return new TextEncoder().encode(raw);
}

const ADMIN_TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export async function signAdminToken(admin: AdminRow): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminTokenPayload = {
    sub: admin.id,
    email: admin.email,
    permissions: admin.permissions ?? {},
    is_super_admin: !!admin.is_super_admin,
    iat: now,
    exp: now + ADMIN_TOKEN_TTL_SECONDS,
    iss: "mangalam-admin",
  };
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("mangalam-admin")
    .setExpirationTime(`${ADMIN_TOKEN_TTL_SECONDS}s`)
    .setIssuedAt(now)
    .sign(getAdminJwtSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAdminJwtSecret(), {
      algorithms: ["HS256"],
      issuer: "mangalam-admin",
    });
    return payload as AdminTokenPayload;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Password hashing (PBKDF2-SHA256 via Web Crypto — edge-compatible)
// Format: pbkdf2$iterations$saltHex$hashHex
// ─────────────────────────────────────────────────────────────────────────────
const PBKDF2_ITERATIONS = 120_000;
const KEY_LENGTH_BITS = 256;

function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    KEY_LENGTH_BITS
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bufToHex(salt.buffer)}$${bufToHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
    const iterations = parseInt(parts[1], 10);
    const salt = hexToBuf(parts[2]);
    const expected = parts[3];
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    const hash = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
      key,
      KEY_LENGTH_BITS
    );
    // constant-time-ish compare
    const actual = bufToHex(hash);
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) {
      diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────
export function normalizePermissions(input: unknown): AdminPermissions {
  if (!input || typeof input !== "object") return {};
  const obj = input as Record<string, unknown>;
  const out: AdminPermissions = {};
  for (const f of ADMIN_FEATURES) {
    const v = obj[f];
    if (typeof v === "boolean") out[f] = v;
  }
  return out;
}

export function rowToAdmin(r: Record<string, unknown>): AdminRow {
  return {
    id: String(r.id),
    email: String(r.email),
    full_name: (r.full_name as string | null) ?? null,
    permissions: normalizePermissions(r.permissions),
    is_active: !!r.is_active,
    is_super_admin: !!r.is_super_admin,
    last_login_at: (r.last_login_at as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function fetchAdminById(id: string): Promise<AdminRow | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("admins")
    .select("id,email,full_name,permissions,is_active,is_super_admin,last_login_at,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return rowToAdmin(data);
}

export function hasPermission(admin: { permissions: AdminPermissions; is_super_admin: boolean }, feature: AdminFeature): boolean {
  if (admin.is_super_admin) return true;
  return admin.permissions?.[feature] === true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Middleware: require a valid admin token, optionally a specific feature
// ─────────────────────────────────────────────────────────────────────────────
export const requireAdmin = (feature?: AdminFeature) =>
  createMiddleware(async (c, next) => {
    const auth = c.req.header("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return c.json({ error: "Missing admin token" }, 401);
    }
    const token = auth.slice("Bearer ".length).trim();
    const payload = await verifyAdminToken(token);
    if (!payload) {
      return c.json({ error: "Invalid or expired admin session" }, 401);
    }
    const admin = await fetchAdminById(payload.sub);
    if (!admin || !admin.is_active) {
      return c.json({ error: "Admin account not found or disabled" }, 403);
    }
    if (feature && !hasPermission(admin, feature)) {
      return c.json({ error: "You do not have permission to perform this action" }, 403);
    }
    c.set("admin", admin);
    c.set("adminFeature", feature ?? null);
    await next();
  });
