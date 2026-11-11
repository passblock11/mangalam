/**
 * Server-only admin session helpers.
 * Reads/verifies the admin JWT from the httpOnly cookie.
 * Import ONLY from server components / server actions — never from client components.
 */

import { cookies } from "next/headers";
import { jwtVerify, type JWTPayload } from "jose";
import type { AdminFeature, AdminSession } from "./admin-session";

export const ADMIN_COOKIE = "mangalam_admin_token";

export type AdminTokenPayload = JWTPayload & {
  sub: string;
  email: string;
  permissions: Partial<Record<AdminFeature, boolean>>;
  is_super_admin: boolean;
};

export function getBackendUrl(): string {
  return (process.env.BACKEND_URL ?? "https://mangalam-api.vercel.app").replace(/\/$/, "");
}

function getAdminJwtSecret(): Uint8Array {
  const raw = process.env.ADMIN_JWT_SECRET;
  if (!raw) throw new Error("ADMIN_JWT_SECRET is not set");
  return new TextEncoder().encode(raw);
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

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyAdminToken(token);
  if (!payload) return null;
  return {
    id: payload.sub,
    email: payload.email,
    full_name: null,
    permissions: payload.permissions ?? {},
    is_active: true,
    is_super_admin: !!payload.is_super_admin,
    last_login_at: null,
    created_at: "",
    updated_at: "",
  };
}

export async function requireAdminFeature(
  feature: AdminFeature
): Promise<
  | { ok: true; admin: AdminSession }
  | { ok: false; error: string }
> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Sign in to continue." };
  if (admin.is_super_admin || admin.permissions?.[feature] === true) {
    return { ok: true, admin };
  }
  return { ok: false, error: "You do not have permission to perform this action." };
}

export async function getAdminToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value ?? null;
}
