"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ActionResult } from "@/lib/actionResult";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAdmin(): Promise<
  ActionResult<{ userId: string }>
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: ue,
  } = await supabase.auth.getUser();
  if (ue || !user) {
    return { ok: false, error: "Sign in to continue." };
  }

  const { data: prof, error: pe } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (pe) {
    return { ok: false, error: pe.message };
  }
  if (!prof?.is_admin) {
    return { ok: false, error: "Not authorized." };
  }

  return { ok: true, data: { userId: user.id } };
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
  const auth = await requireAdmin();
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
  const auth = await requireAdmin();
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
  const auth = await requireAdmin();
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
  const auth = await requireAdmin();
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
  const auth = await requireAdmin();
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
  const auth = await requireAdmin();
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
    let signed: Record<string, string> = {};
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
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  try {
    const sb = supabaseAdmin();
    const { error } = await sb
      .from("profiles")
      .update({
        verification_status: approved ? "approved" : "rejected",
        is_verified: approved,
        verification_reviewed_at: new Date().toISOString(),
        verification_note: note ?? null,
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
