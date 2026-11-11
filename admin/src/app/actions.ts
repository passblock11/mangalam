"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ActionResult } from "@/lib/actionResult";
import { requireAdminFeature } from "@/lib/admin-session-server";
import { revalidatePath } from "next/cache";

async function requireAdmin(feature: "overview" | "verifications" | "users" | "reports" | "payments") {
  return requireAdminFeature(feature);
}

function mapDbError(message: string): string {
  if (message.includes("Could not find the table") && message.includes("reports")) {
    return `${message} Run supabase/migrations/0001_initial_schema.sql then 0002_profile_sections.sql in the Supabase SQL editor for this project (see docs/DEPLOY.md).`;
  }
  return message;
}

export async function fetchReports(): Promise<
  ActionResult<
    {
      id: string;
      reporter_id: string;
      reported_profile_id: string;
      reason: string;
      status: string;
      created_at: string;
    }[]
  >
> {
  const auth = await requireAdmin("reports");
  if (!auth.ok) return auth;

  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("reports")
      .select("id,reporter_id,reported_profile_id,reason,status,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      return { ok: false, error: mapDbError(error.message) };
    }
    return { ok: true, data: data ?? [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

export async function setReportStatus(
  reportId: string,
  status: "open" | "reviewing" | "closed"
): Promise<ActionResult<void>> {
  const auth = await requireAdmin("reports");
  if (!auth.ok) return auth;

  try {
    const sb = supabaseAdmin();
    const { error } = await sb.from("reports").update({ status }).eq("id", reportId);
    if (error) {
      return { ok: false, error: mapDbError(error.message) };
    }
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

export async function setProfileVerified(
  profileId: string,
  isVerified: boolean
): Promise<ActionResult<void>> {
  const auth = await requireAdmin("verifications");
  if (!auth.ok) return auth;

  try {
    const sb = supabaseAdmin();
    const { error } = await sb
      .from("profiles")
      .update({ is_verified: isVerified, updated_at: new Date().toISOString() })
      .eq("id", profileId);
    if (error) {
      return { ok: false, error: mapDbError(error.message) };
    }
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

export async function fetchProfiles(query: string): Promise<
  ActionResult<
    {
      id: string;
      display_name: string | null;
      phone: string | null;
      city: string | null;
      state: string | null;
      is_verified: boolean;
      created_at: string;
    }[]
  >
> {
  const auth = await requireAdmin("users");
  if (!auth.ok) return auth;

  try {
    const sb = supabaseAdmin();
    let q = sb
      .from("profiles")
      .select("id,display_name,phone,city,state,is_verified,created_at")
      .order("created_at", { ascending: false })
      .limit(80);
    const t = query.trim();
    if (t) {
      q = q.or(`display_name.ilike.%${t}%,phone.ilike.%${t}%,city.ilike.%${t}%`);
    }
    const { data, error } = await q;
    if (error) {
      return { ok: false, error: mapDbError(error.message) };
    }
    return { ok: true, data: data ?? [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

export async function setContactCredits(
  profileId: string,
  contactCredits: number
): Promise<ActionResult<void>> {
  const auth = await requireAdmin("users");
  if (!auth.ok) return auth;

  if (contactCredits < 0 || !Number.isFinite(contactCredits)) {
    return { ok: false, error: "Invalid credit amount" };
  }

  try {
    const sb = supabaseAdmin();
    const { error } = await sb.from("wallets").upsert(
      {
        profile_id: profileId,
        contact_credits: Math.floor(contactCredits),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" }
    );
    if (error) {
      return { ok: false, error: mapDbError(error.message) };
    }
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

export async function fetchPendingVerifications(): Promise<
  ActionResult<
    {
      id: string;
      display_name: string | null;
      phone: string | null;
      whatsapp_number: string | null;
      selfie_url: string | null;
      govt_id_url: string | null;
      verification_status: string;
      verification_submitted_at: string | null;
      verification_note: string | null;
    }[]
  >
> {
  const auth = await requireAdmin("verifications");
  if (!auth.ok) return auth;

  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("profiles")
      .select(
        "id,display_name,phone,whatsapp_number,selfie_url,govt_id_url,verification_status,verification_submitted_at,verification_note"
      )
      .in("verification_status", ["pending", "approved", "rejected"])
      .order("verification_submitted_at", { ascending: false })
      .limit(100);
    if (error) {
      return { ok: false, error: mapDbError(error.message) };
    }
    // selfie_url / govt_id_url are stored as storage paths in the private
    // `verification-docs` bucket. Generate short-lived signed URLs so the
    // admin can preview them.
    const rows = data ?? [];
    const paths = rows.flatMap((r) =>
      [r.selfie_url, r.govt_id_url].filter((p): p is string => !!p && !p.startsWith("http"))
    );
    const signed: Record<string, string> = {};
    if (paths.length > 0) {
      const { data: signedData, error: signedErr } = await sb
        .storage.from("verification-docs")
        .createSignedUrls(paths, 60 * 60);
      if (!signedErr && signedData) {
        for (const item of signedData) {
          if (item.path && item.signedURL) signed[item.path] = item.signedURL;
        }
      }
    }
    const withUrls = rows.map((r) => ({
      ...r,
      selfie_url: r.selfie_url
        ? (r.selfie_url.startsWith("http") ? r.selfie_url : signed[r.selfie_url] ?? null)
        : null,
      govt_id_url: r.govt_id_url
        ? (r.govt_id_url.startsWith("http") ? r.govt_id_url : signed[r.govt_id_url] ?? null)
        : null,
    }));
    return { ok: true, data: withUrls };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

export async function reviewVerification(
  profileId: string,
  approved: boolean,
  note?: string
): Promise<ActionResult<void>> {
  const auth = await requireAdmin("verifications");
  if (!auth.ok) return auth;

  // Rejections MUST include a reason — the member sees it in the app.
  const trimmedNote = note?.trim();
  if (!approved && (!trimmedNote || trimmedNote.length === 0)) {
    return { ok: false, error: "A rejection reason is required." };
  }

  try {
    const sb = supabaseAdmin();
    const { error } = await sb
      .from("profiles")
      .update({
        verification_status: approved ? "approved" : "rejected",
        is_verified: approved,
        verification_reviewed_at: new Date().toISOString(),
        verification_note: approved ? null : (trimmedNote ?? null),
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId);
    if (error) {
      return { ok: false, error: mapDbError(error.message) };
    }
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview stats
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchStats(): Promise<
  ActionResult<{
    totalUsers: number;
    verifiedUsers: number;
    pendingVerifications: number;
    openReports: number;
    premiumActive: number;
    totalCredits: number;
    totalPayments: number;
    totalRevenuePaise: number;
    newUsers7d: number;
  }>
> {
  const auth = await requireAdmin("overview");
  if (!auth.ok) return auth;

  try {
    const sb = supabaseAdmin();

    const [{ count: totalUsers }, { count: verifiedUsers }, { count: pendingVerifications }, { count: openReports }] =
      await Promise.all([
        sb.from("profiles").select("*", { count: "exact", head: true }),
        sb.from("profiles").select("*", { count: "exact", head: true }).eq("is_verified", true),
        sb.from("profiles").select("*", { count: "exact", head: true }).eq("verification_status", "pending"),
        sb.from("reports").select("*", { count: "exact", head: true }).eq("status", "open"),
      ]);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { count: newUsers7d } = await sb
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo);

    const { data: premRows } = await sb
      .from("wallets")
      .select("contact_credits, premium_until")
      .gt("premium_until", new Date().toISOString());
    const premiumActive = premRows?.length ?? 0;
    const totalCredits = premRows?.reduce((s, w) => s + (w.contact_credits ?? 0), 0) ?? 0;

    const { count: totalPayments, data: payRows } = await sb
      .from("razorpay_payment_credits")
      .select("amount_paise", { count: "exact" });
    const totalRevenuePaise = payRows?.reduce((s, p) => s + (p.amount_paise ?? 0), 0) ?? 0;

    return {
      ok: true,
      data: {
        totalUsers: totalUsers ?? 0,
        verifiedUsers: verifiedUsers ?? 0,
        pendingVerifications: pendingVerifications ?? 0,
        openReports: openReports ?? 0,
        premiumActive,
        totalCredits,
        totalPayments: totalPayments ?? 0,
        totalRevenuePaise,
        newUsers7d: newUsers7d ?? 0,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// User detail
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchUserDetail(
  profileId: string
): Promise<ActionResult<Record<string, unknown>>> {
  const auth = await requireAdmin("users");
  if (!auth.ok) return auth;

  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("profiles")
      .select(
        "id,display_name,phone,whatsapp_number,phone_visible,date_of_birth,gender,community,mother_tongue,diet,height_cm,profile_for,marital_status,city,state,country,bio,is_verified,is_admin,verification_status,verification_note,verification_submitted_at,verification_reviewed_at,created_at,updated_at,last_active_at,mangal_dosh,birth_time,birth_place,occupation,education_level,monthly_salary,photo_urls"
      )
      .eq("id", profileId)
      .maybeSingle();
    if (error) return { ok: false, error: mapDbError(error.message) };
    if (!data) return { ok: false, error: "Profile not found" };

    const { data: wallet } = await sb
      .from("wallets")
      .select("contact_credits,premium_until,updated_at")
      .eq("profile_id", profileId)
      .maybeSingle();

    const { count: reportsAgainst } = await sb
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("reported_profile_id", profileId);

    const { count: reportsBy } = await sb
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("reporter_id", profileId);

    let bannedUntil: string | null = null;
    try {
      const { data: u } = await sb.auth.admin.getUserById(profileId);
      if (u?.user?.banned_until) bannedUntil = u.user.banned_until as string;
    } catch {
      // ignore
    }

    return {
      ok: true,
      data: {
        ...data,
        photo_urls: (data.photo_urls as string[] | null) ?? null,
        wallet: wallet ?? null,
        reports_against_count: reportsAgainst ?? 0,
        reports_by_count: reportsBy ?? 0,
        banned_until: bannedUntil,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Grant premium / revoke / ban
// ─────────────────────────────────────────────────────────────────────────────
export async function grantPremium(
  profileId: string,
  days: number
): Promise<ActionResult<void>> {
  const auth = await requireAdmin("users");
  if (!auth.ok) return auth;
  if (!Number.isFinite(days) || days <= 0) {
    return { ok: false, error: "Invalid duration" };
  }

  try {
    const sb = supabaseAdmin();
    const until = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
    const { error } = await sb.from("wallets").upsert(
      {
        profile_id: profileId,
        premium_until: until,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" }
    );
    if (error) return { ok: false, error: mapDbError(error.message) };
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

export async function revokePremium(profileId: string): Promise<ActionResult<void>> {
  const auth = await requireAdmin("users");
  if (!auth.ok) return auth;
  try {
    const sb = supabaseAdmin();
    const { error } = await sb
      .from("wallets")
      .update({ premium_until: null, updated_at: new Date().toISOString() })
      .eq("profile_id", profileId);
    if (error) return { ok: false, error: mapDbError(error.message) };
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

export async function banUser(
  profileId: string,
  banned: boolean
): Promise<ActionResult<void>> {
  const auth = await requireAdmin("users");
  if (!auth.ok) return auth;
  try {
    const sb = supabaseAdmin();
    if (banned) {
      const { error } = await sb.auth.admin.updateUserById(profileId, {
        ban_duration: "87600h",
      });
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await sb.auth.admin.updateUserById(profileId, {
        ban_duration: "none",
      });
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Payments ledger
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchPayments(): Promise<
  ActionResult<
    {
      razorpay_payment_id: string;
      profile_id: string;
      credits: number;
      amount_paise: number;
      created_at: string;
      display_name: string | null;
      phone: string | null;
    }[]
  >
> {
  const auth = await requireAdmin("payments");
  if (!auth.ok) return auth;
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("razorpay_payment_credits")
      .select("razorpay_payment_id,profile_id,credits,amount_paise,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return { ok: false, error: mapDbError(error.message) };

    const ids = Array.from(new Set((data ?? []).map((r) => r.profile_id)));
    const { data: profs } = await sb
      .from("profiles")
      .select("id,display_name,phone")
      .in("id", ids);
    const map = new Map((profs ?? []).map((p) => [p.id, p]));

    const rows = (data ?? []).map((r) => ({
      ...r,
      display_name: map.get(r.profile_id)?.display_name ?? null,
      phone: map.get(r.profile_id)?.phone ?? null,
    }));
    return { ok: true, data: rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent activity
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchRecentActivity(): Promise<
  ActionResult<{
    signups: { id: string; display_name: string | null; phone: string | null; created_at: string }[];
    verifications: {
      id: string;
      display_name: string | null;
      verification_status: string;
      verification_submitted_at: string | null;
    }[];
    reports: {
      id: string;
      reported_profile_id: string;
      reason: string;
      status: string;
      created_at: string;
    }[];
  }>
> {
  const auth = await requireAdmin("overview");
  if (!auth.ok) return auth;
  try {
    const sb = supabaseAdmin();
    const [signups, verifications, reports] = await Promise.all([
      sb
        .from("profiles")
        .select("id,display_name,phone,created_at")
        .order("created_at", { ascending: false })
        .limit(6),
      sb
        .from("profiles")
        .select("id,display_name,verification_status,verification_submitted_at")
        .in("verification_status", ["pending", "approved", "rejected"])
        .order("verification_submitted_at", { ascending: false, nullsFirst: false })
        .limit(6),
      sb
        .from("reports")
        .select("id,reported_profile_id,reason,status,created_at")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);
    return {
      ok: true,
      data: {
        signups: signups.data ?? [],
        verifications: verifications.data ?? [],
        reports: reports.data ?? [],
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reports with context
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchReportsWithContext(): Promise<
  ActionResult<
    {
      id: string;
      reporter_id: string;
      reported_profile_id: string;
      reason: string;
      status: string;
      created_at: string;
      reported_name: string | null;
      reported_phone: string | null;
      reporter_name: string | null;
    }[]
  >
> {
  const auth = await requireAdmin("reports");
  if (!auth.ok) return auth;
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("reports")
      .select("id,reporter_id,reported_profile_id,reason,status,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return { ok: false, error: mapDbError(error.message) };

    const ids = Array.from(
      new Set((data ?? []).flatMap((r) => [r.reporter_id, r.reported_profile_id]))
    );
    const { data: profs } = await sb
      .from("profiles")
      .select("id,display_name,phone")
      .in("id", ids);
    const map = new Map((profs ?? []).map((p) => [p.id, p]));

    const rows = (data ?? []).map((r) => ({
      ...r,
      reported_name: map.get(r.reported_profile_id)?.display_name ?? null,
      reported_phone: map.get(r.reported_profile_id)?.phone ?? null,
      reporter_name: map.get(r.reporter_id)?.display_name ?? null,
    }));
    return { ok: true, data: rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Profiles list (enhanced with wallet + verification)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchProfilesEnhanced(query: string): Promise<
  ActionResult<
    {
      id: string;
      display_name: string | null;
      phone: string | null;
      whatsapp_number: string | null;
      city: string | null;
      state: string | null;
      gender: string | null;
      is_verified: boolean;
      verification_status: string | null;
      created_at: string;
      last_active_at: string | null;
      photo_urls: string[] | null;
      premium_until: string | null;
      contact_credits: number | null;
    }[]
  >
> {
  const auth = await requireAdmin("users");
  if (!auth.ok) return auth;
  try {
    const sb = supabaseAdmin();
    let q = sb
      .from("profiles")
      .select(
        "id,display_name,phone,whatsapp_number,city,state,gender,is_verified,verification_status,created_at,last_active_at,photo_urls"
      )
      .order("created_at", { ascending: false })
      .limit(80);
    const t = query.trim();
    if (t) {
      q = q.or(`display_name.ilike.%${t}%,phone.ilike.%${t}%,city.ilike.%${t}%`);
    }
    const { data, error } = await q;
    if (error) return { ok: false, error: mapDbError(error.message) };

    const ids = (data ?? []).map((r) => r.id);
    const { data: wallets } = await sb
      .from("wallets")
      .select("profile_id,premium_until,contact_credits")
      .in("profile_id", ids);
    const wmap = new Map((wallets ?? []).map((w) => [w.profile_id, w]));

    const rows = (data ?? []).map((r) => ({
      ...r,
      photo_urls: (r.photo_urls as string[] | null) ?? null,
      premium_until: wmap.get(r.id)?.premium_until ?? null,
      contact_credits: wmap.get(r.id)?.contact_credits ?? null,
    }));
    return { ok: true, data: rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}
