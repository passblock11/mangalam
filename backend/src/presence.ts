import { getSupabaseAdmin } from "./supabase.js";

/** One missed 25s heartbeat still counts. A stopped app drops off within this window. */
const ONLINE_WINDOW_MS = 70_000;

export async function onlineSet(ids: string[]): Promise<Set<string>> {
  const wanted = [...new Set(ids.filter((id) => id.length > 0))];
  if (wanted.length === 0) return new Set();
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("member_presence")
      .select("profile_id,last_seen_at")
      .in("profile_id", wanted);
    if (error || !data) return new Set();
    const cutoff = Date.now() - ONLINE_WINDOW_MS;
    const online = new Set<string>();
    for (const row of data) {
      const at = Date.parse(String(row.last_seen_at ?? ""));
      if (Number.isFinite(at) && at >= cutoff) online.add(String(row.profile_id));
    }
    return online;
  } catch {
    return new Set();
  }
}

/** Best-effort. A missing table or a profile that is still being created must not fail the app. */
export async function recordPresence(profileId: string, online: boolean): Promise<boolean> {
  try {
    const sb = getSupabaseAdmin();
    const lastSeen = online
      ? new Date().toISOString()
      : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error } = await sb.from("member_presence").upsert(
      { profile_id: profileId, last_seen_at: lastSeen },
      { onConflict: "profile_id" }
    );
    return !error;
  } catch {
    return false;
  }
}
