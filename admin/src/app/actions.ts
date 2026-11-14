"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ActionResult } from "@/lib/actionResult";
import { getAdminToken, getBackendUrl, requireAdminFeature } from "@/lib/admin-session-server";
import { revalidatePath } from "next/cache";

async function requireAdmin(feature: "overview" | "verifications" | "users" | "reports" | "payments") {
  return requireAdminFeature(feature);
}

export async function notifyAudience(input: {
  title: string;
  body: string;
  audience: "all" | "female" | "female_unpaid";
}) {
  const title = input.title.slice(0, 120);
  const body = input.body.slice(0, 400);
  try {
    const token = await getAdminToken();
    if (!token) return;
    await fetch(`${getBackendUrl()}/v1/admin/notify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audience: input.audience,
        type: "system",
        title,
        body,
        data: { source: "admin" },
      }),
      cache: "no-store",
    });
  } catch {
    /* The setting already saved. A missed alert must not undo it. */
  }
}

async function notifyMember(
  sb: ReturnType<typeof supabaseAdmin>,
  row: {
    profile_id: string;
    type: "system" | "verification" | "report";
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }
) {
  const title = row.title.slice(0, 120);
  const body = row.body.slice(0, 400);
  try {
    const token = await getAdminToken();
    if (token) {
      const res = await fetch(`${getBackendUrl()}/v1/admin/notify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profile_id: row.profile_id,
          type: row.type,
          title,
          body,
          data: row.data ?? {},
        }),
        cache: "no-store",
      });
      if (res.ok) return;
    }
  } catch {
    /* Fall through to a direct insert so the in-app list still updates. */
  }
  try {
    await sb.from("notifications").insert({
      profile_id: row.profile_id,
      type: row.type,
      title,
      body,
      data: row.data ?? {},
    });
  } catch {
    /* The action that triggered this already succeeded. */
  }
}

function mapDbError(message: string): string {
  if (message.includes("Could not find the table") && message.includes("reports")) {
    return `${message} Run supabase/migrations/0001_initial_schema.sql then 0002_profile_sections.sql in the Supabase SQL editor for this project (see docs/DEPLOY.md).`;
  }
  return message;
}

/** Auth emails keyed by profile id. One paged lookup, reused by every member list. */
async function memberEmails(
  sb: ReturnType<typeof supabaseAdmin>
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  try {
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !data.users.length) break;
      for (const user of data.users) map.set(user.id, user.email ?? null);
      if (data.users.length < 1000) break;
    }
  } catch {
    /* leave emails blank if Auth admin is unavailable */
  }
  return map;
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
  status: "open" | "reviewing" | "closed" | "actioned"
): Promise<ActionResult<void>> {
  const auth = await requireAdmin("reports");
  if (!auth.ok) return auth;

  try {
    const sb = supabaseAdmin();
    const { data: existing } = await sb
      .from("reports")
      .select("reporter_id")
      .eq("id", reportId)
      .maybeSingle();
    const { error } = await sb.from("reports").update({ status }).eq("id", reportId);
    if (error) {
      return { ok: false, error: mapDbError(error.message) };
    }
    if (existing?.reporter_id && (status === "closed" || status === "actioned")) {
      await notifyMember(sb, {
        profile_id: existing.reporter_id,
        type: "report",
        title: "Your report was reviewed",
        body:
          status === "actioned"
            ? "Our team took action on your report."
            : "Our team closed your report.",
        data: { report_id: reportId, status },
      });
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
    await notifyMember(sb, {
      profile_id: profileId,
      type: "verification",
      title: isVerified ? "Profile verified" : "Verification updated",
      body: isVerified
        ? "Your profile is now verified."
        : "Your verified badge was removed.",
      data: { status: isVerified ? "approved" : "removed" },
    });
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
    const next = Math.floor(contactCredits);
    const previous = await sb
      .from("wallets")
      .select("contact_credits")
      .eq("profile_id", profileId)
      .maybeSingle();
    const { error } = await sb.from("wallets").upsert(
      {
        profile_id: profileId,
        contact_credits: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" }
    );
    if (error) {
      return { ok: false, error: mapDbError(error.message) };
    }
    if (Number(previous.data?.contact_credits ?? 0) !== next) {
      await notifyMember(sb, {
        profile_id: profileId,
        type: "system",
        title: "Contact credits updated",
        body: `Your contact credit balance is now ${next}.`,
        data: { source: "admin" },
      });
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
      email: string | null;
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
          if (!item.path) continue;
          // SDK returns signedURL (RELATIVE path like /object/sign/...) and
          // signedUrl (FULL https URL). Use the full URL so the <img> tag
          // loads from Supabase, not the admin domain (which 404s).
          const full = item.signedUrl ?? item.signedURL;
          if (full) {
            signed[item.path] = full.startsWith("http")
              ? full
              : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1${full}`;
          }
        }
      }
    }
    const emails = await memberEmails(sb);
    const withUrls = rows.map((r) => ({
      ...r,
      email: emails.get(r.id) ?? null,
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
    await notifyMember(sb, {
      profile_id: profileId,
      type: "verification",
      title: approved ? "Profile verified" : "Verification needs an update",
      body: approved
        ? "Your profile is verified."
        : (trimmedNote ?? "Please submit your verification again."),
      data: { status: approved ? "approved" : "rejected" },
    });
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

export async function sendMemberUpdate(input: {
  title: string;
  body: string;
}): Promise<ActionResult<{ sent: number }>> {
  const auth = await requireAdmin("overview");
  if (!auth.ok) return auth;
  const title = input.title.trim().slice(0, 80);
  const body = input.body.trim().slice(0, 240);
  if (!title || !body) return { ok: false, error: "Add a title and a message." };
  try {
    const token = await getAdminToken();
    if (token) {
      const res = await fetch(`${getBackendUrl()}/v1/admin/notify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ all: true, type: "system", title, body }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as { sent?: number; error?: string } | null;
      if (res.ok) return { ok: true, data: { sent: data?.sent ?? 0 } };
    }
    const sb = supabaseAdmin();
    const ids: string[] = [];
    for (let from = 0; from < 20000; from += 500) {
      const { data, error } = await sb
        .from("profiles")
        .select("id,is_banned")
        .range(from, from + 499);
      if (error) return { ok: false, error: mapDbError(error.message) };
      const page = data ?? [];
      for (const row of page) {
        if (row.is_banned === true) continue;
        ids.push(row.id);
      }
      if (page.length < 500) break;
    }
    let sent = 0;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200).map((id) => ({
        profile_id: id,
        type: "system" as const,
        title,
        body,
        data: { source: "admin" },
      }));
      const { error } = await sb.from("notifications").insert(chunk);
      if (error) return { ok: false, error: mapDbError(error.message), };
      sent += chunk.length;
    }
    return { ok: true, data: { sent } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

/** One member, from the user drawer. Does not touch the send-to-all update. */
export async function sendUserUpdate(input: {
  profileId: string;
  title: string;
  body: string;
}): Promise<ActionResult<{ sent: number }>> {
  const auth = await requireAdmin("users");
  if (!auth.ok) return auth;
  const profileId = input.profileId.trim();
  const title = input.title.trim().slice(0, 80);
  const body = input.body.trim().slice(0, 240);
  if (!profileId) return { ok: false, error: "Choose a member." };
  if (!title || !body) return { ok: false, error: "Add a title and a message." };
  try {
    const token = await getAdminToken();
    if (token) {
      const res = await fetch(`${getBackendUrl()}/v1/admin/notify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profile_id: profileId,
          type: "system",
          title,
          body,
          data: { source: "admin" },
        }),
        cache: "no-store",
      });
      if (res.ok) return { ok: true, data: { sent: 1 } };
    }
    const sb = supabaseAdmin();
    const { error } = await sb.from("notifications").insert({
      profile_id: profileId,
      type: "system",
      title,
      body,
      data: { source: "admin" },
    });
    if (error) return { ok: false, error: mapDbError(error.message) };
    return { ok: true, data: { sent: 1 } };
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
    let email: string | null = null;
    try {
      const { data: u } = await sb.auth.admin.getUserById(profileId);
      email = u?.user?.email ?? null;
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
        email,
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
    await notifyMember(sb, {
      profile_id: profileId,
      type: "system",
      title: "Premium is active",
      body: `Premium is active on your account for ${Math.floor(days)} days.`,
      data: { source: "admin" },
    });
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
    await notifyMember(sb, {
      profile_id: profileId,
      type: "system",
      title: "Premium removed",
      body: "Premium was removed from your account.",
      data: { source: "admin" },
    });
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

export async function banUser(
  profileId: string,
  banned: boolean,
  reason?: string
): Promise<ActionResult<void>> {
  const auth = await requireAdmin("users");
  if (!auth.ok) return auth;
  try {
    const sb = supabaseAdmin();
    if (banned) {
      const trimmed = reason?.trim() || null;
      // 1) Flag the profile — requireAuth checks this on every API call
      const { error: pErr } = await sb
        .from("profiles")
        .update({
          is_banned: true,
          banned_at: new Date().toISOString(),
          ban_reason: trimmed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId);
      if (pErr) return { ok: false, error: mapDbError(pErr.message) };
      // 2) Ban at the Supabase Auth layer so they can't refresh / re-login
      const { error } = await sb.auth.admin.updateUserById(profileId, {
        ban_duration: "87600h",
      });
      if (error) return { ok: false, error: error.message };
      await notifyMember(sb, {
        profile_id: profileId,
        type: "system",
        title: "Account suspended",
        body: trimmed
          ? `Your account has been suspended. ${trimmed}`
          : "Your account has been suspended.",
        data: { source: "admin" },
      });
    } else {
      // Unban: clear the profile flag + the Supabase Auth ban
      const { error: pErr } = await sb
        .from("profiles")
        .update({
          is_banned: false,
          banned_at: null,
          ban_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId);
      if (pErr) return { ok: false, error: mapDbError(pErr.message) };
      const { error } = await sb.auth.admin.updateUserById(profileId, {
        ban_duration: "none",
      });
      if (error) return { ok: false, error: error.message };
      await notifyMember(sb, {
        profile_id: profileId,
        type: "system",
        title: "Account restored",
        body: "Your account is active again.",
        data: { source: "admin" },
      });
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
      email: string | null;
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

    const emails = await memberEmails(sb);
    const rows = (data ?? []).map((r) => ({
      ...r,
      display_name: map.get(r.profile_id)?.display_name ?? null,
      phone: map.get(r.profile_id)?.phone ?? null,
      email: emails.get(r.profile_id) ?? null,
    }));
    return { ok: true, data: rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

export async function fetchMemberSubscriptions(): Promise<
  ActionResult<
    {
      id: string;
      profile_id: string;
      plan_code: string;
      razorpay_subscription_id: string;
      status: string;
      current_period_end: string | null;
      cancel_at_period_end: boolean;
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
      .from("member_subscriptions")
      .select(
        "id,profile_id,plan_code,razorpay_subscription_id,status,current_period_end,cancel_at_period_end,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return { ok: false, error: mapDbError(error.message) };
    const ids = Array.from(new Set((data ?? []).map((r) => r.profile_id)));
    const { data: profs } = ids.length
      ? await sb.from("profiles").select("id,display_name,phone").in("id", ids)
      : { data: [] };
    const map = new Map((profs ?? []).map((p) => [p.id, p]));
    return {
      ok: true,
      data: (data ?? []).map((r) => ({
        ...r,
        display_name: map.get(r.profile_id)?.display_name ?? null,
        phone: map.get(r.profile_id)?.phone ?? null,
      })),
    };
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
    signups: { id: string; display_name: string | null; phone: string | null; email: string | null; created_at: string }[];
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
    const emails = await memberEmails(sb);
    return {
      ok: true,
      data: {
        signups: (signups.data ?? []).map((s) => ({
          ...s,
          email: emails.get(s.id) ?? null,
        })),
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
      title: string | null;
      description: string | null;
      category: string;
      screenshot_urls: string[];
      reason: string;
      status: string;
      created_at: string;
      reviewed_at: string | null;
      admin_notes: string | null;
      resolution: string | null;
      reported_name: string | null;
      reported_phone: string | null;
      reported_email: string | null;
      reported_photo: string | null;
      reported_banned: boolean;
      reported_verified: boolean;
      reporter_name: string | null;
      reporter_phone: string | null;
      reporter_email: string | null;
    }[]
  >
> {
  const auth = await requireAdmin("reports");
  if (!auth.ok) return auth;
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("reports")
      .select(
        "id,reporter_id,reported_profile_id,title,description,category,screenshot_urls,reason,status,created_at,reviewed_at,admin_notes,resolution"
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return { ok: false, error: mapDbError(error.message) };

    const ids = Array.from(
      new Set((data ?? []).flatMap((r) => [r.reporter_id, r.reported_profile_id]))
    );
    const { data: profs } = await sb
      .from("profiles")
      .select("id,display_name,phone,photo_urls,is_banned,is_verified")
      .in("id", ids);
    const map = new Map((profs ?? []).map((p) => [p.id, p]));

    const emails = await memberEmails(sb);
    const rows = (data ?? []).map((r) => {
      const reported = map.get(r.reported_profile_id);
      const reporter = map.get(r.reporter_id);
      const photoUrls = (reported?.photo_urls as string[] | null) ?? null;
      return {
        ...r,
        reported_name: reported?.display_name ?? null,
        reported_phone: reported?.phone ?? null,
        reported_email: emails.get(r.reported_profile_id) ?? null,
        reported_photo: photoUrls && photoUrls.length > 0 ? photoUrls[0] : null,
        reported_banned: !!reported?.is_banned,
        reported_verified: !!reported?.is_verified,
        reporter_name: reporter?.display_name ?? null,
        reporter_phone: reporter?.phone ?? null,
        reporter_email: emails.get(r.reporter_id) ?? null,
      };
    });
    return { ok: true, data: rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapDbError(msg) };
  }
}

export async function updateReport(
  reportId: string,
  patch: { status?: "open" | "reviewing" | "closed" | "actioned"; admin_notes?: string; resolution?: string }
): Promise<ActionResult<void>> {
  const auth = await requireAdmin("reports");
  if (!auth.ok) return auth;
  try {
    const sb = supabaseAdmin();
    const update: Record<string, unknown> = {};
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.admin_notes !== undefined) update.admin_notes = patch.admin_notes;
    if (patch.resolution !== undefined) update.resolution = patch.resolution;
    if (patch.status === "closed" || patch.status === "actioned") {
      update.reviewed_at = new Date().toISOString();
    }
    const { data: existing } = await sb
      .from("reports")
      .select("reporter_id")
      .eq("id", reportId)
      .maybeSingle();
    const { error } = await sb.from("reports").update(update).eq("id", reportId);
    if (error) return { ok: false, error: mapDbError(error.message) };
    if (
      existing?.reporter_id &&
      (patch.status === "closed" || patch.status === "actioned")
    ) {
      const note = patch.resolution?.trim() || patch.admin_notes?.trim();
      await notifyMember(sb, {
        profile_id: existing.reporter_id,
        type: "report",
        title: "Your report was reviewed",
        body: note || "Our team reviewed your report.",
        data: { report_id: reportId, status: patch.status },
      });
    }
    revalidatePath("/");
    return { ok: true, data: undefined };
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
      email: string | null;
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

    const emails = await memberEmails(sb);
    const rows = (data ?? []).map((r) => ({
      ...r,
      email: emails.get(r.id) ?? null,
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
