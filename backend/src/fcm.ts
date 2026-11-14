/**
 * FCM (Firebase Cloud Messaging) push delivery — Edge-runtime compatible.
 *
 * Uses the FCM HTTP v1 API with an OAuth2 access token minted from a
 * Firebase service-account JSON. No Node-only SDKs; we sign the JWT with
 * `jose` (already a dependency) and exchange it for an OAuth2 token via
 * `fetch`, then POST to `fcm.googleapis.com`.
 *
 * Env: `FIREBASE_SERVICE_ACCOUNT` — the full service-account JSON string
 * downloaded from Firebase → Project Settings → Service Accounts → Generate.
 * If unset, push sending is skipped (graceful degradation) but in-app rows
 * are still inserted, so Supabase Realtime delivery keeps working.
 */
import { SignJWT, importPKCS8 } from "jose";
import { env } from "./env.js";
import { getSupabaseAdmin } from "./supabase.js";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

let cachedAccount: ServiceAccount | null = null;
let cachedKey: CryptoKey | null = null;
let cachedToken: { token: string; exp: number } | null = null;

function parseServiceAccount(): ServiceAccount | null {
  const raw = env("FIREBASE_SERVICE_ACCOUNT");
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as ServiceAccount;
    if (!obj.project_id || !obj.client_email || !obj.private_key) return null;
    return obj;
  } catch {
    return null;
  }
}

async function getSigningKey(): Promise<{ account: ServiceAccount; key: CryptoKey } | null> {
  const account = parseServiceAccount();
  if (!account) return null;
  if (cachedAccount === account && cachedKey) {
    return { account: cachedAccount!, key: cachedKey };
  }
  // Firebase private keys are PKCS8 PEM with literal "\n" escapes.
  const pem = account.private_key.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "RS256");
  cachedAccount = account;
  cachedKey = key;
  return { account, key };
}

async function getAccessToken(): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const sk = await getSigningKey();
  if (!sk) return null;
  const { account, key } = sk;

  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setSubject(account.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) return null;
  const tokenJson = (await tokenRes.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: tokenJson.access_token,
    exp: now + (tokenJson.expires_in ?? 3600),
  };
  return cachedToken.token;
}

type PushPayload = {
  title: string;
  body?: string;
  type?: string;
  data?: Record<string, string>;
};

function channelFor(type: string): string {
  if (type === "message") return "mangalam_messages";
  if (type === "system" || type === "verification" || type === "report" || type === "support") {
    return "mangalam_updates";
  }
  return "mangalam_activity";
}

function fcmErrorCode(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const error = (body as { error?: { status?: string; details?: unknown[] } }).error;
  if (!error) return "";
  const details = Array.isArray(error.details) ? error.details : [];
  for (const item of details) {
    if (item && typeof item === "object" && "errorCode" in item) {
      const code = (item as { errorCode?: unknown }).errorCode;
      if (typeof code === "string") return code;
    }
  }
  return error.status ?? "";
}

/** Send a push to every registered FCM token for a profile. Best-effort. */
export async function sendPushToProfile(
  profileId: string,
  payload: PushPayload
): Promise<void> {
  const accessToken = await getAccessToken();
  if (!accessToken) return; // Firebase not configured — skip push, in-app still works.

  const account = parseServiceAccount();
  if (!account) return;

  const sb = getSupabaseAdmin();
  const { data: tokens } = await sb
    .from("notification_tokens")
    .select("fcm_token")
    .eq("profile_id", profileId);

  const fcmTokens = (tokens ?? []).map((t) => t.fcm_token).filter(Boolean);
  if (fcmTokens.length === 0) return;

  const type = payload.type || payload.data?.type || "system";
  const data: Record<string, string> = {
    ...(payload.data ?? {}),
    type,
    title: payload.title,
    body: payload.body ?? "",
  };

  await Promise.all(
    fcmTokens.map(async (token) => {
      try {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token,
                notification: {
                  title: payload.title,
                  body: payload.body ?? "",
                },
                data,
                android: {
                  priority: "HIGH",
                  notification: {
                    channel_id: channelFor(type),
                    sound: "default",
                    notification_priority: "PRIORITY_HIGH",
                    default_vibrate_timings: true,
                    icon: "ic_stat_mangalam",
                    color: "#B71C1C",
                  },
                },
                apns: {
                  headers: { "apns-priority": "10" },
                  payload: {
                    aps: { sound: "default", badge: 1 },
                  },
                },
              },
            }),
          }
        );
        if (res.ok) return;
        const errBody = await res.json().catch(() => null);
        const code = fcmErrorCode(errBody);
        // A bad payload is a 400 too. Only drop tokens Firebase says are dead.
        if (code === "UNREGISTERED" || code === "NOT_FOUND") {
          await sb.from("notification_tokens").delete().eq("fcm_token", token);
        }
      } catch {
        // network error — ignore, push is best-effort
      }
    })
  );
}
