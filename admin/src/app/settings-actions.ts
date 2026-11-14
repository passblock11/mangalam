"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ActionResult } from "@/lib/actionResult";
import { revalidatePath } from "next/cache";
import {
  requireAdminFeature,
  getAdminToken,
  getBackendUrl,
} from "@/lib/admin-session-server";
import { type AdminFeature } from "@/lib/admin-session";
import { BUILTIN_BRAND, sanitizeBrandCustom, type BrandCustom } from "./ui/settings/brand";
import { notifyAudience } from "./actions";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function requireSettings() {
  return requireAdminFeature("settings");
}

async function requireAdmins() {
  return requireAdminFeature("admins");
}

function mapErr(m: string) {
  return m;
}

async function backendCall(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAdminToken();
  if (!token) throw new Error("No admin session");
  return fetch(`${getBackendUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

// ── App settings (singleton) ────────────────────────────────────────────────
export async function fetchAppSettings(): Promise<ActionResult<Record<string, unknown>>> {
  const auth = await requireSettings();
  if (!auth.ok) return auth;
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) return { ok: false, error: mapErr(error.message) };
  return { ok: true, data: data ?? {} };
}

export async function updateAppSettings(
  patch: Record<string, unknown>
): Promise<ActionResult<void>> {
  const auth = await requireSettings();
  if (!auth.ok) return auth;
  const sb = supabaseAdmin();
  const { data: before } = await sb.from("app_settings").select("*").eq("id", 1).maybeSingle();
  const { error } = await sb
    .from("app_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { ok: false, error: mapErr(error.message) };
  await announceSettingChanges((before ?? {}) as Record<string, unknown>, patch);
  revalidatePath("/");
  return { ok: true, data: undefined };
}

function sameAmount(left: unknown, right: unknown): boolean {
  const a = Number(left);
  const b = Number(right);
  if (!Number.isFinite(a) && !Number.isFinite(b)) return true;
  return Math.floor(a) === Math.floor(b);
}

/** Push only the members whose prices or membership access actually changed. */
async function announceSettingChanges(
  before: Record<string, unknown>,
  patch: Record<string, unknown>
) {
  const changed = (key: string) => key in patch && !sameAmount(before[key], patch[key]);
  const amount = (key: string) => Math.max(0, Math.floor(Number(patch[key]) || 0));
  const lines: string[] = [];
  if (changed("phone_credit_cost")) {
    lines.push(`Viewing a phone number now uses ${amount("phone_credit_cost")} credits.`);
  }
  if (changed("whatsapp_credit_cost")) {
    lines.push(`Viewing WhatsApp now uses ${amount("whatsapp_credit_cost")} credits.`);
  }
  if (changed("message_credit_cost")) {
    lines.push(`Each message now uses ${amount("message_credit_cost")} credits.`);
  }
  if (changed("message_free_per_chat")) {
    lines.push(`Each chat includes ${amount("message_free_per_chat")} free messages.`);
  }
  if (
    "message_charge_replies" in patch &&
    Boolean(before.message_charge_replies) !== Boolean(patch.message_charge_replies)
  ) {
    lines.push(
      patch.message_charge_replies === false
        ? "Replies no longer use credits."
        : "Replies now use credits too."
    );
  }
  if (lines.length > 0) {
    await notifyAudience({
      title: "Credit prices updated",
      body: lines.join(" "),
      audience: "all",
    });
  }
  if (
    "female_membership_free" in patch &&
    Boolean(before.female_membership_free) !== Boolean(patch.female_membership_free)
  ) {
    if (patch.female_membership_free === true) {
      await notifyAudience({
        title: "Membership included",
        body: "You can use Mangalam without buying a membership. Phone, WhatsApp and messages are included.",
        audience: "female",
      });
    } else {
      await notifyAudience({
        title: "Membership is now required",
        body: "A membership is required for paid features. Credit packs stay available after you subscribe.",
        audience: "female_unpaid",
      });
    }
  }
}

// ── Payment methods ──────────────────────────────────────────────────────────
export async function fetchPaymentMethods(): Promise<ActionResult<any[]>> {
  const auth = await requireSettings();
  if (!auth.ok) return auth;
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("payment_methods")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) return { ok: false, error: mapErr(error.message) };
  return { ok: true, data: data ?? [] };
}

export async function upsertPaymentMethod(
  method: {
    id?: string;
    provider: string;
    display_name: string;
    config: Record<string, unknown>;
    is_active: boolean;
    sort_order: number;
  }
): Promise<ActionResult<void>> {
  const auth = await requireSettings();
  if (!auth.ok) return auth;
  const sb = supabaseAdmin();
  // Only one active at a time: if setting active, deactivate others first
  if (method.is_active) {
    await sb.from("payment_methods").update({ is_active: false }).neq("id", method.id ?? "00000000-0000-0000-0000-000000000000");
  }
  if (method.id) {
    const { error } = await sb
      .from("payment_methods")
      .update({
        provider: method.provider,
        display_name: method.display_name,
        config: method.config,
        is_active: method.is_active,
        sort_order: method.sort_order,
        updated_at: new Date().toISOString(),
      })
      .eq("id", method.id);
    if (error) return { ok: false, error: mapErr(error.message) };
  } else {
    const { error } = await sb.from("payment_methods").insert({
      provider: method.provider,
      display_name: method.display_name,
      config: method.config,
      is_active: method.is_active,
      sort_order: method.sort_order,
    });
    if (error) return { ok: false, error: mapErr(error.message) };
  }
  // Keep app_settings.active_payment_method in sync
  if (method.is_active) {
    await sb
      .from("app_settings")
      .update({ active_payment_method: method.provider, updated_at: new Date().toISOString() })
      .eq("id", 1);
  }
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function deletePaymentMethod(id: string): Promise<ActionResult<void>> {
  const auth = await requireSettings();
  if (!auth.ok) return auth;
  const sb = supabaseAdmin();
  const { error } = await sb.from("payment_methods").delete().eq("id", id);
  if (error) return { ok: false, error: mapErr(error.message) };
  revalidatePath("/");
  return { ok: true, data: undefined };
}

// ── Plans ────────────────────────────────────────────────────────────────────
export async function fetchPlansAdmin(): Promise<ActionResult<any[]>> {
  const auth = await requireSettings();
  if (!auth.ok) return auth;
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("plans")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) return { ok: false, error: mapErr(error.message) };
  return { ok: true, data: data ?? [] };
}

export async function upsertPlan(plan: {
  id?: string;
  code: string;
  name: string;
  description?: string;
  plan_type: string;
  price_paise: number;
  credits: number;
  duration_days?: number | null;
  billing_period?: string;
  total_cycles?: number;
  is_active: boolean;
  sort_order: number;
}): Promise<ActionResult<void>> {
  const auth = await requireSettings();
  if (!auth.ok) return auth;
  const sb = supabaseAdmin();
  let changed = true;
  if (plan.id) {
    const { data: before } = await sb
      .from("plans")
      .select("name,description,price_paise,credits,duration_days,is_active")
      .eq("id", plan.id)
      .maybeSingle();
    const { error } = await sb
      .from("plans")
      .update({ ...plan, updated_at: new Date().toISOString() })
      .eq("id", plan.id);
    if (error) return { ok: false, error: mapErr(error.message) };
    changed =
      !before ||
      before.name !== plan.name ||
      (before.description ?? "") !== (plan.description ?? "") ||
      before.price_paise !== plan.price_paise ||
      before.credits !== plan.credits ||
      before.duration_days !== (plan.duration_days ?? null) ||
      before.is_active !== plan.is_active;
  } else {
    const { error } = await sb.from("plans").insert(plan);
    if (error) return { ok: false, error: mapErr(error.message) };
  }
  if (changed) {
    await notifyAudience({
      title: "Membership plans updated",
      body: "Open My Membership to see the current plans.",
      audience: "all",
    });
  }
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function deletePlan(id: string): Promise<ActionResult<void>> {
  const auth = await requireSettings();
  if (!auth.ok) return auth;
  const sb = supabaseAdmin();
  const { error } = await sb.from("plans").delete().eq("id", id);
  if (error) return { ok: false, error: mapErr(error.message) };
  await notifyAudience({
    title: "Membership plans updated",
    body: "Open My Membership to see the current plans.",
    audience: "all",
  });
  revalidatePath("/");
  return { ok: true, data: undefined };
}

// ── Coupons ──────────────────────────────────────────────────────────────────
export async function fetchCoupons(): Promise<ActionResult<any[]>> {
  const auth = await requireSettings();
  if (!auth.ok) return auth;
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: mapErr(error.message) };
  return { ok: true, data: data ?? [] };
}

export async function upsertCoupon(coupon: {
  id?: string;
  code: string;
  description?: string;
  discount_type: string;
  discount_value: number;
  min_amount_paise?: number;
  max_uses?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active: boolean;
}): Promise<ActionResult<void>> {
  const auth = await requireSettings();
  if (!auth.ok) return auth;
  const sb = supabaseAdmin();
  const payload = {
    ...coupon,
    code: coupon.code.trim().toUpperCase(),
    updated_at: new Date().toISOString(),
  };
  if (coupon.id) {
    const { error } = await sb.from("coupons").update(payload).eq("id", coupon.id);
    if (error) return { ok: false, error: mapErr(error.message) };
  } else {
    const { error } = await sb.from("coupons").insert(payload);
    if (error) return { ok: false, error: mapErr(error.message) };
  }
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function deleteCoupon(id: string): Promise<ActionResult<void>> {
  const auth = await requireSettings();
  if (!auth.ok) return auth;
  const sb = supabaseAdmin();
  const { error } = await sb.from("coupons").delete().eq("id", id);
  if (error) return { ok: false, error: mapErr(error.message) };
  revalidatePath("/");
  return { ok: true, data: undefined };
}

// ── Legal pages ──────────────────────────────────────────────────────────────
export async function fetchLegalPagesAdmin(): Promise<ActionResult<any[]>> {
  const auth = await requireSettings();
  if (!auth.ok) return auth;
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("legal_pages")
    .select("*")
    .order("title", { ascending: true });
  if (error) return { ok: false, error: mapErr(error.message) };
  return { ok: true, data: data ?? [] };
}

export async function upsertLegalPage(page: {
  id?: string;
  slug: string;
  title: string;
  body: string;
  is_published: boolean;
}): Promise<ActionResult<void>> {
  const auth = await requireSettings();
  if (!auth.ok) return auth;
  const sb = supabaseAdmin();
  const payload = {
    ...page,
    slug: page.slug.trim().toLowerCase(),
    updated_at: new Date().toISOString(),
  };
  if (page.id) {
    const { error } = await sb
      .from("legal_pages")
      .update({ ...payload, version: undefined })
      .eq("id", page.id);
    if (error) return { ok: false, error: mapErr(error.message) };
  } else {
    const { error } = await sb.from("legal_pages").insert(payload);
    if (error) return { ok: false, error: mapErr(error.message) };
  }
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function deleteLegalPage(id: string): Promise<ActionResult<void>> {
  const auth = await requireSettings();
  if (!auth.ok) return auth;
  const sb = supabaseAdmin();
  const { error } = await sb.from("legal_pages").delete().eq("id", id);
  if (error) return { ok: false, error: mapErr(error.message) };
  revalidatePath("/");
  return { ok: true, data: undefined };
}

// ── Admin management (custom admins table, via backend) ──────────────────────
export type AdminAccount = {
  id: string;
  email: string;
  full_name: string | null;
  permissions: Partial<Record<AdminFeature, boolean>>;
  is_active: boolean;
  is_super_admin: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchAdminAccounts(): Promise<ActionResult<AdminAccount[]>> {
  const auth = await requireAdmins();
  if (!auth.ok) return auth;
  try {
    const res = await backendCall("/v1/admin/admins");
    const data = (await res.json().catch(() => null)) as
      | { admins?: AdminAccount[]; error?: string }
      | null;
    if (!res.ok) return { ok: false, error: data?.error ?? `Failed (${res.status})` };
    return { ok: true, data: data?.admins ?? [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function createAdminAccount(input: {
  email: string;
  password: string;
  full_name?: string;
  permissions: Partial<Record<AdminFeature, boolean>>;
  is_super_admin?: boolean;
}): Promise<ActionResult<AdminAccount>> {
  const auth = await requireAdmins();
  if (!auth.ok) return auth;
  try {
    const res = await backendCall("/v1/admin/admins", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const data = (await res.json().catch(() => null)) as
      | { admin?: AdminAccount; error?: string }
      | null;
    if (!res.ok) return { ok: false, error: data?.error ?? `Failed (${res.status})` };
    revalidatePath("/");
    return { ok: true, data: data!.admin! };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function updateAdminAccount(
  id: string,
  patch: {
    full_name?: string;
    permissions?: Partial<Record<AdminFeature, boolean>>;
    is_active?: boolean;
    is_super_admin?: boolean;
    password?: string;
  }
): Promise<ActionResult<AdminAccount>> {
  const auth = await requireAdmins();
  if (!auth.ok) return auth;
  try {
    const res = await backendCall(`/v1/admin/admins/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    const data = (await res.json().catch(() => null)) as
      | { admin?: AdminAccount; error?: string }
      | null;
    if (!res.ok) return { ok: false, error: data?.error ?? `Failed (${res.status})` };
    revalidatePath("/");
    return { ok: true, data: data!.admin! };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function saveAppBranding(input: {
  active: "default" | "custom";
  custom: BrandCustom;
}): Promise<ActionResult<void>> {
  const auth = await requireSettings();
  if (!auth.ok) return auth;
  const branding = {
    active: input.active === "custom" ? "custom" : "default",
    builtin: BUILTIN_BRAND,
    custom: sanitizeBrandCustom(input.custom),
  };
  const saved = await updateAppSettings({ branding });
  if (!saved.ok && /branding|schema cache|column/i.test(saved.error ?? "")) {
    return {
      ok: false,
      error: "Run supabase/migrations/0015_app_branding.sql in the behlr SQL editor, then save again.",
    };
  }
  return saved;
}

export async function uploadBrandingImage(
  formData: FormData
): Promise<ActionResult<{ url: string }>> {
  const auth = await requireSettings();
  if (!auth.ok) return auth;
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose an image." };
  if (file.size <= 0) return { ok: false, error: "That image is empty." };
  if (file.size > 4 * 1024 * 1024) return { ok: false, error: "Image must be under 4 MB." };
  const type = file.type.toLowerCase();
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "image/jpeg" ? "jpg" : "";
  if (!ext) return { ok: false, error: "Use a JPG, PNG, or WebP image." };
  const path = `branding/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sb = supabaseAdmin();
  const { error } = await sb.storage.from("app-branding").upload(path, bytes, {
    contentType: type,
    upsert: false,
  });
  if (error) {
    const missing = /bucket|not found/i.test(error.message);
    return {
      ok: false,
      error: missing
        ? "Run supabase/migrations/0015_app_branding.sql in the behlr SQL editor, then upload again."
        : error.message,
    };
  }
  const { data } = sb.storage.from("app-branding").getPublicUrl(path);
  return { ok: true, data: { url: data.publicUrl } };
}

export async function deleteAdminAccount(id: string): Promise<ActionResult<void>> {
  const auth = await requireAdmins();
  if (!auth.ok) return auth;
  try {
    const res = await backendCall(`/v1/admin/admins/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) return { ok: false, error: data?.error ?? `Failed (${res.status})` };
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
