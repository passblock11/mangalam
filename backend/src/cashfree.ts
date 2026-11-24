import { applyCharge, saveSubscription } from "./billing.js";
import { env } from "./env.js";
import { cashfreeKeys, cashfreeKeySets, type CashfreeKeys } from "./integrations.js";
import { getSupabaseAdmin } from "./supabase.js";

const API_VERSION = "2025-01-01";

export type CashfreeConfig = CashfreeKeys;

export function cashfreeBase(environment: CashfreeConfig["environment"]): string {
  return environment === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

export async function cashfreeConfig(): Promise<CashfreeConfig | { error: string }> {
  return cashfreeKeys();
}

export async function cashfreeConfigs(): Promise<CashfreeConfig[]> {
  return cashfreeKeySets();
}

function savedText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function activePaymentProvider(): Promise<"phonepe" | "cashfree" | "razorpay"> {
  const envReady = Boolean(env("CASHFREE_CLIENT_ID")?.trim() && env("CASHFREE_CLIENT_SECRET")?.trim());
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("app_settings")
      .select(
        "active_payment_method,cashfree_client_id,cashfree_sandbox_client_id,cashfree_live_client_id,phonepe_sandbox_client_id,phonepe_live_client_id,phonepe_sandbox_merchant_id,phonepe_live_merchant_id"
      )
      .eq("id", 1)
      .maybeSingle();
    if (error) return envReady ? "cashfree" : "razorpay";
    // Admin choice wins. Explicit PhonePe/Cashfree must not fall through to another gateway.
    if (data?.active_payment_method === "phonepe") return "phonepe";
    if (data?.active_payment_method === "cashfree") return "cashfree";
    if (data?.active_payment_method === "razorpay") return "razorpay";
    const cashfreeSaved = [data?.cashfree_client_id, data?.cashfree_sandbox_client_id, data?.cashfree_live_client_id]
      .some((value) => savedText(value).length > 0);
    // Saved or server Cashfree keys collect through Cashfree. Filling in the App ID
    // must not send the website or the phone back to Razorpay.
    if (cashfreeSaved || envReady) return "cashfree";
  } catch {
    return envReady ? "cashfree" : "razorpay";
  }
  return "razorpay";
}

export async function cashfreeFetch(
  cfg: CashfreeConfig,
  path: string,
  init: { method: string; body?: unknown; idempotencyKey?: string }
): Promise<{ ok: boolean; status: number; data: unknown; text: string }> {
  const headers: Record<string, string> = {
    "x-client-id": cfg.clientId,
    "x-client-secret": cfg.clientSecret,
    "x-api-version": API_VERSION,
    accept: "application/json",
    "content-type": "application/json",
  };
  if (init.idempotencyKey) headers["x-idempotency-key"] = init.idempotencyKey;
  const res = await fetch(`${cashfreeBase(cfg.environment)}${path}`, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  return { ok: res.ok, status: res.status, data, text };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function cashfreeError(data: unknown, text: string, status: number): string {
  const record = asRecord(data);
  const message = record?.message ?? record?.error;
  if (typeof message === "string" && message.trim()) return message;
  return text.slice(0, 240) || `HTTP ${status}`;
}

export async function verifyCashfreeWebhook(
  cfg: CashfreeConfig,
  rawBody: string,
  signature: string,
  timestamp: string
): Promise<boolean> {
  if (!signature || !timestamp || !rawBody) return false;
  const sent = Number(timestamp);
  // Cashfree sends x-webhook-timestamp in milliseconds (e.g. 1746427757933).
  // Older samples sometimes look like seconds — accept either.
  if (!Number.isFinite(sent) || sent <= 0) return false;
  const sentMs = sent > 1e12 ? sent : sent * 1000;
  if (Math.abs(Date.now() - sentMs) > 10 * 60 * 1000) return false;
  const expected = await hmacBase64(cfg.clientSecret, `${timestamp}${rawBody}`);
  return safeEqual(expected, signature);
}

async function hmacBase64(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  let binary = "";
  for (const byte of new Uint8Array(sig)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export function rupees(paise: number): number {
  return Number((paise / 100).toFixed(2));
}

export function paiseOf(rupeeAmount: unknown): number {
  const n = typeof rupeeAmount === "number" ? rupeeAmount : Number(rupeeAmount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export async function payerFor(profileId: string): Promise<
  | { id: string; name: string; email: string; phone: string }
  | { error: string }
> {
  const sb = getSupabaseAdmin();
  const { data: profile } = await sb
    .from("profiles")
    .select("display_name,phone")
    .eq("id", profileId)
    .maybeSingle();
  const user = await sb.auth.admin.getUserById(profileId).catch(() => null);
  const email = user?.data.user?.email?.trim() || `${profileId.replace(/-/g, "").slice(0, 16)}@members.mangalam.app`;
  const rawPhone = String(profile?.phone || user?.data.user?.phone || "");
  const digits = rawPhone.replace(/\D/g, "");
  const ten = digits.length >= 10 ? digits.slice(-10) : "";
  if (!/^[6-9]\d{9}$/.test(ten)) {
    return { error: "Add a valid Indian mobile number on your profile before paying." };
  }
  const name = String(profile?.display_name || "Mangalam member").trim().slice(0, 40) || "Mangalam member";
  return { id: profileId, name, email, phone: `+91${ten}` };
}

type ChargeNotes = {
  profileId: string;
  planCode: string;
  credits: number;
  premiumDays: number;
  amountPaise: number;
};

function notesFrom(tags: unknown): ChargeNotes | null {
  if (!tags || typeof tags !== "object") return null;
  const row = tags as Record<string, unknown>;
  const profileId = String(row.profile_id ?? "");
  const amountPaise = Number.parseInt(String(row.amount_paise ?? ""), 10);
  const credits = Number.parseInt(String(row.credits ?? "0"), 10);
  const premiumDays = Number.parseInt(String(row.premium_days ?? "0"), 10);
  if (!profileId || !Number.isFinite(amountPaise) || amountPaise < 100) return null;
  return {
    profileId,
    planCode: String(row.plan_code ?? ""),
    credits: Number.isFinite(credits) && credits > 0 ? credits : 0,
    premiumDays: Number.isFinite(premiumDays) && premiumDays > 0 ? premiumDays : 0,
    amountPaise,
  };
}

/** Confirm a paid order with Cashfree, then grant credits and membership days once. */
export async function fulfillCashfreeOrder(
  cfg: CashfreeConfig,
  orderId: string,
  expectedProfileId?: string
): Promise<{ ok: true; already: boolean } | { ok: false; error: string; status: 400 | 403 | 404 | 500 | 502 | 503 }> {
  const order = await cashfreeFetch(cfg, `/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
  const orderData = asRecord(order.data);
  if (!order.ok || !orderData) {
    return { ok: false, error: `Could not load the Cashfree order: ${cashfreeError(order.data, order.text, order.status)}`, status: 502 };
  }
  if (String(orderData.order_status ?? "") !== "PAID") {
    return { ok: false, error: "Payment is not confirmed yet.", status: 400 };
  }
  const notes = notesFrom(orderData.order_tags);
  if (!notes) return { ok: false, error: "This order is missing Mangalam payment details.", status: 400 };
  if (expectedProfileId && notes.profileId !== expectedProfileId) {
    return { ok: false, error: "This payment does not belong to this account.", status: 403 };
  }
  if (paiseOf(orderData.order_amount) !== notes.amountPaise) {
    return { ok: false, error: "The paid amount does not match the plan.", status: 400 };
  }

  const payments = await cashfreeFetch(cfg, `/orders/${encodeURIComponent(orderId)}/payments`, { method: "GET" });
  const list = Array.isArray(payments.data) ? payments.data : [];
  const success = list.find((item) => String((item as { payment_status?: string }).payment_status) === "SUCCESS") as
    | { cf_payment_id?: string | number }
    | undefined;
  const paymentId = success?.cf_payment_id ? `cf_${success.cf_payment_id}` : `cforder_${orderId}`;
  const applied = await applyCharge({
    paymentId,
    profileId: notes.profileId,
    credits: notes.credits,
    premiumDays: notes.premiumDays,
    amountPaise: notes.amountPaise,
    planCode: notes.planCode || null,
  });
  if (!applied.ok) return applied;
  return { ok: true, already: applied.already };
}

export async function fulfillCashfreeSubscription(
  cfg: CashfreeConfig,
  subscriptionId: string,
  expectedProfileId?: string
): Promise<{ ok: true; already: boolean } | { ok: false; error: string; status: 400 | 403 | 404 | 500 | 502 | 503 }> {
  const loaded = await cashfreeFetch(cfg, `/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "GET" });
  const sub = asRecord(loaded.data);
  if (!loaded.ok || !sub) {
    return { ok: false, error: `Could not load the Cashfree membership: ${cashfreeError(loaded.data, loaded.text, loaded.status)}`, status: 502 };
  }
  const status = String(sub.subscription_status ?? sub.status ?? "").toUpperCase();
  const auth = (asRecord(sub.authorization_details) ?? {}) as { authorization_status?: string; payment_id?: string };
  // Cashfree marks a successful mandate as ACTIVE (not SUCCESS). SUCCESS appears on payment_status.
  const authStatus = String(auth.authorization_status ?? "").toUpperCase();
  const authorised =
    status === "ACTIVE" || authStatus === "ACTIVE" || authStatus === "SUCCESS";
  if (!authorised) return { ok: false, error: "Membership payment is not confirmed yet.", status: 400 };
  const notes = notesFrom(sub.subscription_tags);
  if (!notes) return { ok: false, error: "This membership is missing Mangalam payment details.", status: 400 };
  if (expectedProfileId && notes.profileId !== expectedProfileId) {
    return { ok: false, error: "This membership does not belong to this account.", status: 403 };
  }
  const paymentId = auth.payment_id ? `cfsubpay_${auth.payment_id}` : `cfsub_${subscriptionId}`;
  const applied = await applyCharge({
    paymentId,
    profileId: notes.profileId,
    credits: notes.credits,
    premiumDays: notes.premiumDays,
    amountPaise: notes.amountPaise,
    planCode: notes.planCode || null,
  });
  if (!applied.ok) return applied;
  const periodEnd = new Date(Date.now() + notes.premiumDays * 24 * 3600 * 1000).toISOString();
  await saveSubscription({
    profileId: notes.profileId,
    planCode: notes.planCode,
    subscriptionId,
    razorpayPlanId: null,
    status: "active",
    periodEnd,
  });
  return { ok: true, already: applied.already };
}

type FulfillResult =
  | { ok: true; already: boolean }
  | { ok: false; error: string; status: 400 | 403 | 404 | 500 | 502 | 503 };

async function fulfillWithEither<T extends FulfillResult>(
  run: (cfg: CashfreeConfig) => Promise<T>
): Promise<T | { ok: false; error: string; status: 503 }> {
  const configs = await cashfreeConfigs();
  if (configs.length === 0) {
    const cfg = await cashfreeConfig();
    return { ok: false, error: "error" in cfg ? cfg.error : "Cashfree is not configured.", status: 503 };
  }
  let last: T | null = null;
  for (const cfg of configs) {
    const applied = await run(cfg);
    if (applied.ok) return applied;
    if (applied.status !== 502) return applied;
    last = applied;
  }
  return last ?? { ok: false, error: "Could not reach Cashfree.", status: 503 };
}

export function fulfillCashfreeOrderResolved(
  orderId: string,
  expectedProfileId?: string
): Promise<FulfillResult> {
  return fulfillWithEither((cfg) => fulfillCashfreeOrder(cfg, orderId, expectedProfileId));
}

export function fulfillCashfreeSubscriptionResolved(
  subscriptionId: string,
  expectedProfileId?: string
): Promise<FulfillResult> {
  return fulfillWithEither((cfg) => fulfillCashfreeSubscription(cfg, subscriptionId, expectedProfileId));
}

async function manageCashfreeSubscription(
  subscriptionId: string,
  action: "CANCEL" | "PAUSE" | "ACTIVATE",
  actionDetails?: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string; status: 502 | 503 }> {
  const configs = await cashfreeConfigs();
  if (configs.length === 0) {
    const cfg = await cashfreeConfig();
    return { ok: false, error: "error" in cfg ? cfg.error : "Cashfree is not configured.", status: 503 };
  }
  let last = `Could not ${action.toLowerCase()} the membership.`;
  for (const cfg of configs) {
    const body: Record<string, unknown> = { subscription_id: subscriptionId, action };
    if (actionDetails) body.action_details = actionDetails;
    const res = await cashfreeFetch(cfg, `/subscriptions/${encodeURIComponent(subscriptionId)}/manage`, {
      method: "POST",
      body,
      idempotencyKey: `${action.toLowerCase()}_${subscriptionId}`,
    });
    if (res.ok) return { ok: true };
    last = `Could not ${action.toLowerCase()} the membership: ${cashfreeError(res.data, res.text, res.status)}`;
  }
  return { ok: false, error: last, status: 502 };
}

export async function cancelCashfreeSubscription(subscriptionId: string) {
  return manageCashfreeSubscription(subscriptionId, "CANCEL");
}

export async function pauseCashfreeSubscription(subscriptionId: string) {
  return manageCashfreeSubscription(subscriptionId, "PAUSE");
}

export async function activateCashfreeSubscription(
  subscriptionId: string,
  nextScheduledTime: string
) {
  return manageCashfreeSubscription(subscriptionId, "ACTIVATE", {
    next_scheduled_time: nextScheduledTime,
  });
}
