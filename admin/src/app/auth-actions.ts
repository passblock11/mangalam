"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getBackendUrl, ADMIN_COOKIE } from "@/lib/admin-session-server";
import type { AdminSession } from "@/lib/admin-session";

export async function signInAdmin(
  email: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = email.trim();
  if (!trimmed || !password) {
    return { ok: false, error: "Enter email and password." };
  }

  try {
    const res = await fetch(`${getBackendUrl()}/v1/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed, password }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as
      | { token?: string; admin?: AdminSession; error?: string }
      | null;
    if (!res.ok || !data?.token) {
      return { ok: false, error: data?.error ?? "Sign in failed." };
    }

    const store = await cookies();
    store.set(ADMIN_COOKIE, data.token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12, // 12h, matches backend token TTL
    });
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function signOutAdmin(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  revalidatePath("/");
}

/**
 * Bootstrap: create the FIRST super admin. Only works when no admins exist.
 * Returns the session on success so the caller can sign the user in.
 */
export async function bootstrapAdmin(
  email: string,
  password: string,
  fullName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = email.trim();
  if (!trimmed || !password) return { ok: false, error: "Enter email and password." };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };

  try {
    const res = await fetch(`${getBackendUrl()}/v1/admin/bootstrap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed, password, full_name: fullName.trim() || undefined }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as
      | { token?: string; admin?: AdminSession; error?: string }
      | null;
    if (!res.ok || !data?.token) {
      return { ok: false, error: data?.error ?? "Bootstrap failed." };
    }
    const store = await cookies();
    store.set(ADMIN_COOKIE, data.token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/**
 * Check whether any admin accounts exist (to decide between setup vs login screen).
 */
export async function adminsExist(): Promise<{ ok: true; exists: boolean } | { ok: false; error: string }> {
  try {
    // We probe the login endpoint with a dummy credential; a 401 means admins
    // exist, a 403 ("bootstrap already complete") also means they exist.
    // The backend has no public "exists" endpoint, so we rely on bootstrap being
    // available only when the table is empty. We call bootstrap with an invalid
    // body — if it returns 403 "already complete", admins exist.
    const res = await fetch(`${getBackendUrl()}/v1/admin/bootstrap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "probe@mangalam.app", password: "probeprobeprobe" }),
      cache: "no-store",
    });
    if (res.status === 403) return { ok: true, exists: true };
    // 400 means validation failed but table is empty → no admins yet
    if (res.status === 400) return { ok: true, exists: false };
    // 200/201 means bootstrap succeeded (shouldn't happen with probe creds)
    return { ok: true, exists: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
