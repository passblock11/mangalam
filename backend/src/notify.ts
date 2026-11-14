/**
 * Notification dispatch — inserts an in-app notification row (delivered live
 * via Supabase Realtime) and fires a best-effort FCM push for background delivery.
 *
 * Always inserts the row even if FCM is not configured, so the in-app feed +
 * unread badge keep working. Push is additive.
 */
import { getSupabaseAdmin } from "./supabase.js";
import { sendPushToProfile } from "./fcm.js";

export type NotificationType =
  | "like"
  | "match"
  | "message"
  | "shortlist"
  | "view"
  | "system"
  | "verification"
  | "report"
  | "support";

type CreateNotificationInput = {
  profile_id: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
};

/**
 * Create a notification for a user. Inserts the row synchronously and fires
 * the FCM push without blocking (awaited but errors are swallowed).
 */
export async function notify(input: CreateNotificationInput): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("notifications").insert({
    profile_id: input.profile_id,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    data: input.data ?? {},
  });
  if (error) return; // don't crash the parent request over a notification

  // Best-effort push — never throw to the caller.
  try {
    await sendPushToProfile(input.profile_id, {
      title: input.title,
      body: input.body,
      type: input.type,
      data: serializeData({ ...(input.data ?? {}), type: input.type }),
    });
  } catch {
    // ignore
  }
}

/** FCM `data` must be string-valued; coerce common types to strings. */
function serializeData(data?: Record<string, unknown>): Record<string, string> {
  if (!data) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue;
    out[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
}

/**
 * Fetch a profile's display name for building human-readable notification text.
 */
export async function getProfileName(profileId: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("profiles")
    .select("display_name")
    .eq("id", profileId)
    .maybeSingle();
  return data?.display_name ?? "Someone";
}
