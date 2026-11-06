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
