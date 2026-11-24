import {
  activateCashfreeSubscription,
  cancelCashfreeSubscription,
  pauseCashfreeSubscription,
} from "./cashfree.js";
import { env } from "./env.js";
import { razorpayKeySets } from "./integrations.js";
import { notify } from "./notify.js";
import { getSupabaseAdmin } from "./supabase.js";

const PAUSEABLE_SUB_STATUSES = ["active", "authenticated"] as const;
/** Every gateway membership that must be stopped before the account is wiped. */
const CANCEL_ON_DELETE_STATUSES = [
  "active",
  "authenticated",
  "pending",
  "created",
  "paused",
] as const;

const STORAGE_BUCKETS = [
  "profile-photos",
  "verification-docs",
  "chat-attachments",
  "report-screenshots",
  "support-attachments",
] as const;

async function razorpayFetch(
  path: string,
  init: { method: string; headers: Record<string, string>; body?: string }
): Promise<Response> {
  const proxyUrl = env("RAZORPAY_PROXY_URL");
  const proxySecret = env("RAZORPAY_PROXY_SECRET");
  if (proxyUrl && proxySecret) {
    const proxyHeaders: Record<string, string> = {
      "x-proxy-secret": proxySecret,
      "x-target-path": path,
      "content-type": init.headers["Content-Type"] ?? "application/json",
      accept: init.headers["Accept"] ?? "application/json",
      "user-agent": "Mangalam-Backend/1.0",
    };
    if (init.headers.Authorization) proxyHeaders.authorization = init.headers.Authorization;
    return fetch(proxyUrl, {
      method: init.method,
      headers: proxyHeaders,
      body: init.method === "GET" || init.method === "HEAD" ? undefined : init.body,
    });
  }
  return fetch(`https://api.razorpay.com${path}`, {
    method: init.method,
    headers: init.headers,
    body: init.method === "GET" || init.method === "HEAD" ? undefined : init.body,
  });
}

function basicAuth(keyId: string, keySecret: string): string {
  return `Basic ${btoa(`${keyId}:${keySecret}`)}`;
}

async function razorpaySubscriptionAction(
  subscriptionId: string,
  action: "cancel" | "pause" | "resume",
  body: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sets = await razorpayKeySets();
  if ("error" in sets) return { ok: false, error: sets.error };
  if (sets.length === 0) return { ok: false, error: "Razorpay is not configured." };
  let last = `Could not ${action} the membership.`;
  for (const cfg of sets) {
    const res = await razorpayFetch(
      `/v1/subscriptions/${encodeURIComponent(subscriptionId)}/${action}`,
      {
        method: "POST",
        headers: {
          Authorization: basicAuth(cfg.keyId, cfg.keySecret),
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => "");
    last = text || `Razorpay ${action} failed (${res.status}).`;
  }
  return { ok: false, error: last };
}

async function cancelRazorpaySubscription(subscriptionId: string) {
  return razorpaySubscriptionAction(subscriptionId, "cancel", { cancel_at_cycle_end: 0 });
}

async function pauseRazorpaySubscription(subscriptionId: string) {
  return razorpaySubscriptionAction(subscriptionId, "pause", { pause_at: "now" });
}

async function resumeRazorpaySubscription(subscriptionId: string) {
  return razorpaySubscriptionAction(subscriptionId, "resume", { resume_at: "now" });
}

function nextCashfreeChargeTime(periodEnd: string | null): string {
  const fromPeriod = periodEnd ? Date.parse(periodEnd) : NaN;
  const base = Number.isFinite(fromPeriod) && fromPeriod > Date.now()
    ? fromPeriod
    : Date.now() + 24 * 60 * 60 * 1000;
  // Cashfree expects an ISO timestamp; date component drives the next charge.
  return new Date(base).toISOString();
}

/** Pause billable memberships while the member is banned. */
export async function pauseMemberSubscriptionsForBan(profileId: string): Promise<{
  paused: string[];
  failures: string[];
}> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("member_subscriptions")
    .select("id,razorpay_subscription_id,status")
    .eq("profile_id", profileId)
    .in("status", [...PAUSEABLE_SUB_STATUSES]);
  if (error) return { paused: [], failures: [error.message] };

  const paused: string[] = [];
  const failures: string[] = [];
  const now = new Date().toISOString();

  for (const row of data ?? []) {
    const gatewayId = String(row.razorpay_subscription_id ?? "").trim();
    if (!gatewayId) continue;
    let ok = false;
    let detail = "";
    if (gatewayId.startsWith("cfsub")) {
      const result = await pauseCashfreeSubscription(gatewayId);
      ok = result.ok;
      detail = result.ok ? "" : result.error;
    } else {
      const result = await pauseRazorpaySubscription(gatewayId);
      ok = result.ok;
      detail = result.ok ? "" : result.error;
    }
    if (ok) {
      await sb
        .from("member_subscriptions")
        .update({ status: "paused", updated_at: now })
        .eq("id", row.id);
      paused.push(gatewayId);
    } else {
      failures.push(`${gatewayId}: ${detail}`);
    }
  }
  return { paused, failures };
}

/** Resume memberships that were paused for a ban. */
export async function resumeMemberSubscriptionsAfterUnban(profileId: string): Promise<{
  resumed: string[];
  failures: string[];
}> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("member_subscriptions")
    .select("id,razorpay_subscription_id,status,current_period_end")
    .eq("profile_id", profileId)
    .eq("status", "paused");
  if (error) return { resumed: [], failures: [error.message] };

  const resumed: string[] = [];
  const failures: string[] = [];
  const now = new Date().toISOString();

  for (const row of data ?? []) {
    const gatewayId = String(row.razorpay_subscription_id ?? "").trim();
    if (!gatewayId) continue;
    let ok = false;
    let detail = "";
    if (gatewayId.startsWith("cfsub")) {
      const result = await activateCashfreeSubscription(
        gatewayId,
        nextCashfreeChargeTime((row.current_period_end as string | null) ?? null)
      );
      ok = result.ok;
      detail = result.ok ? "" : result.error;
    } else {
      const result = await resumeRazorpaySubscription(gatewayId);
      ok = result.ok;
      detail = result.ok ? "" : result.error;
    }
    if (ok) {
      await sb
        .from("member_subscriptions")
        .update({ status: "active", updated_at: now })
        .eq("id", row.id);
      resumed.push(gatewayId);
    } else {
      failures.push(`${gatewayId}: ${detail}`);
    }
  }
  return { resumed, failures };
}

/** Cancel every open membership for this member at the gateway, then mark local rows cancelled. */
export async function cancelAllMemberSubscriptions(profileId: string): Promise<{
  cancelled: string[];
  failures: string[];
}> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("member_subscriptions")
    .select("id,razorpay_subscription_id,status")
    .eq("profile_id", profileId)
    .in("status", [...CANCEL_ON_DELETE_STATUSES]);
  if (error) {
    return { cancelled: [], failures: [error.message] };
  }

  const cancelled: string[] = [];
  const failures: string[] = [];
  const now = new Date().toISOString();

  for (const row of data ?? []) {
    const gatewayId = String(row.razorpay_subscription_id ?? "").trim();
    if (!gatewayId) {
      await sb
        .from("member_subscriptions")
        .update({
          status: "cancelled",
          cancel_at_period_end: false,
          updated_at: now,
        })
        .eq("id", row.id);
      continue;
    }
    let ok = false;
    let detail = "";
    if (gatewayId.startsWith("cfsub")) {
      const result = await cancelCashfreeSubscription(gatewayId);
      ok = result.ok;
      detail = result.ok ? "" : result.error;
    } else {
      const result = await cancelRazorpaySubscription(gatewayId);
      ok = result.ok;
      detail = result.ok ? "" : result.error;
    }
    if (ok) {
      await sb
        .from("member_subscriptions")
        .update({
          status: "cancelled",
          cancel_at_period_end: false,
          updated_at: now,
        })
        .eq("id", row.id);
      cancelled.push(gatewayId);
    } else {
      failures.push(`${gatewayId}: ${detail}`);
    }
  }
  return { cancelled, failures };
}

function storagePathFromUrl(url: string, bucket: string): string | null {
  const marker = `/${bucket}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  let path = url.slice(i + marker.length).split("?")[0] ?? "";
  try {
    path = decodeURIComponent(path);
  } catch {
    // Keep the raw path.
  }
  if (!path || path.includes("..")) return null;
  return path;
}

/** Recursively remove every object under a member folder in a storage bucket. */
async function clearStoragePrefix(bucket: string, prefix: string): Promise<void> {
  const sb = getSupabaseAdmin();
  try {
    const { data } = await sb.storage.from(bucket).list(prefix, { limit: 1000 });
    if (!data || data.length === 0) return;
    const files: string[] = [];
    for (const item of data) {
      if (!item.name) continue;
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      // Folders come back with a null id from the Storage API.
      if (item.id == null) {
        await clearStoragePrefix(bucket, path);
      } else {
        files.push(path);
      }
    }
    if (files.length > 0) await sb.storage.from(bucket).remove(files);
  } catch {
    // Storage cleanup is best-effort. Row wipe still removes the account data.
  }
}

async function clearMemberStorage(
  profileId: string,
  profile: {
    photo_urls?: unknown;
    selfie_url?: string | null;
    govt_id_url?: string | null;
  }
): Promise<void> {
  const sb = getSupabaseAdmin();
  const profilePhotoPaths: string[] = [];
  const verificationPaths: string[] = [];

  const photos = Array.isArray(profile.photo_urls) ? profile.photo_urls : [];
  for (const url of photos) {
    if (typeof url !== "string") continue;
    const path = storagePathFromUrl(url, "profile-photos");
    if (path) profilePhotoPaths.push(path);
  }
  for (const raw of [profile.selfie_url, profile.govt_id_url]) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const fromUrl =
      storagePathFromUrl(raw, "verification-docs") ??
      storagePathFromUrl(raw, "profile-photos");
    if (fromUrl) verificationPaths.push(fromUrl);
    else if (!raw.startsWith("http")) verificationPaths.push(raw.replace(/^\//, ""));
  }

  try {
    if (profilePhotoPaths.length > 0) {
      await sb.storage.from("profile-photos").remove(profilePhotoPaths);
    }
  } catch {
    // Best-effort.
  }
  try {
    if (verificationPaths.length > 0) {
      await sb.storage.from("verification-docs").remove(verificationPaths);
    }
  } catch {
    // Best-effort.
  }

  for (const bucket of STORAGE_BUCKETS) {
    await clearStoragePrefix(bucket, profileId);
  }
}

/**
 * Remove every public row owned by this member. Cascade covers most children;
 * deleting the profile row is still required so registration form fields cannot
 * linger if auth soft-delete (or a missing FK cascade) leaves them behind.
 */
async function wipeMemberRows(profileId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getSupabaseAdmin();

  // Conversations that only this member belonged to would otherwise linger empty.
  const { data: memberships } = await sb
    .from("conversation_members")
    .select("conversation_id")
    .eq("profile_id", profileId);
  const conversationIds = [...new Set((memberships ?? []).map((row) => String(row.conversation_id)))];

  const { error: profileErr } = await sb.from("profiles").delete().eq("id", profileId);
  if (profileErr) return { ok: false, error: profileErr.message };

  if (conversationIds.length > 0) {
    for (const conversationId of conversationIds) {
      const { count } = await sb
        .from("conversation_members")
        .select("profile_id", { count: "exact", head: true })
        .eq("conversation_id", conversationId);
      if ((count ?? 0) === 0) {
        await sb.from("conversations").delete().eq("id", conversationId);
      }
    }
  }

  const { data: stillThere } = await sb
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .maybeSingle();
  if (stillThere?.id) {
    return { ok: false, error: "Could not remove the member profile row." };
  }
  return { ok: true };
}

export async function purgeMemberAccount(profileId: string): Promise<
  | { ok: true; cancelled_subscriptions: string[]; subscription_warnings: string[] }
  | { ok: false; error: string; status: 404 | 500 | 502 }
> {
  const sb = getSupabaseAdmin();
  const { data: profile, error: profileErr } = await sb
    .from("profiles")
    .select("id,display_name,photo_urls,selfie_url,govt_id_url")
    .eq("id", profileId)
    .maybeSingle();
  if (profileErr) return { ok: false, error: profileErr.message, status: 500 };
  if (!profile) return { ok: false, error: "Member not found.", status: 404 };

  const { cancelled, failures } = await cancelAllMemberSubscriptions(profileId);
  // Never wipe the account while a gateway membership is still open.
  if (failures.length > 0) {
    return {
      ok: false,
      error: `Could not cancel every membership before deletion. ${failures.join(" ")}`,
      status: 502,
    };
  }

  // Push + in-app notice while the member and FCM tokens still exist.
  await notify({
    profile_id: profileId,
    type: "system",
    title: "Account deleted",
    body:
      "Your Mangalam account was deleted as requested. You have been signed out. You can sign in with Google again anytime to create a new account.",
    data: { source: "admin", action: "account_deleted" },
  });

  // Same immediate lockout path as a ban, so the open app session signs out
  // on the next API call before the auth user is removed.
  await sb
    .from("profiles")
    .update({
      is_banned: true,
      banned_at: new Date().toISOString(),
      ban_reason:
        "Your Mangalam account was deleted. You can sign in with Google again to create a new account.",
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);
  await sb.auth.admin.updateUserById(profileId, { ban_duration: "87600h" }).catch(() => null);

  await clearMemberStorage(profileId, profile);

  // Explicit profile wipe removes registration form fields and cascaded rows
  // (wallet, likes, tickets, subscriptions, etc.). Do not rely only on auth
  // cascade — soft-deleted auth users can leave profiles behind.
  const wiped = await wipeMemberRows(profileId);
  if (!wiped.ok) return { ok: false, error: wiped.error, status: 500 };

  // Hard delete so the same Google email can register a fresh account later.
  const { error: deleteErr } = await sb.auth.admin.deleteUser(profileId, false);
  if (deleteErr) {
    // Profile rows are already gone. Auth may already be absent after a retry.
    const missing =
      /not found|user not found|does not exist/i.test(deleteErr.message);
    if (!missing) {
      return { ok: false, error: deleteErr.message, status: 500 };
    }
  }

  return {
    ok: true,
    cancelled_subscriptions: cancelled,
    subscription_warnings: failures,
  };
}
