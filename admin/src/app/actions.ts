"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { revalidatePath } from "next/cache";

function requireSecret(secret: string) {
  const expected = process.env.ADMIN_DASHBOARD_SECRET;
  if (!expected || secret !== expected) {
    throw new Error("Unauthorized");
  }
}

export async function fetchReports(secret: string) {
  requireSecret(secret);
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("reports")
    .select("id,reporter_id,reported_profile_id,reason,status,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function setReportStatus(
  secret: string,
  reportId: string,
  status: "open" | "reviewing" | "closed"
) {
  requireSecret(secret);
  const sb = supabaseAdmin();
  const { error } = await sb.from("reports").update({ status }).eq("id", reportId);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function setProfileVerified(
  secret: string,
  profileId: string,
  isVerified: boolean
) {
  requireSecret(secret);
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("profiles")
    .update({ is_verified: isVerified, updated_at: new Date().toISOString() })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function fetchProfiles(secret: string, query: string) {
  requireSecret(secret);
  const sb = supabaseAdmin();
  let q = sb
    .from("profiles")
    .select(
      "id,display_name,phone,city,state,is_verified,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(80);
  const t = query.trim();
  if (t) {
    q = q.or(`display_name.ilike.%${t}%,phone.ilike.%${t}%,city.ilike.%${t}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function setContactCredits(
  secret: string,
  profileId: string,
  contactCredits: number
) {
  requireSecret(secret);
  if (contactCredits < 0 || !Number.isFinite(contactCredits)) {
    throw new Error("Invalid credit amount");
  }
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("wallets")
    .upsert(
      {
        profile_id: profileId,
        contact_credits: Math.floor(contactCredits),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" }
    );
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
