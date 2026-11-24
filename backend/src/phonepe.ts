import { accessDays, applyCharge, saveSubscription } from "./billing.js";
import { env } from "./env.js";
import { phonepeKeySets, phonepeKeys, type PhonePeKeys } from "./integrations.js";

type TokenCache = { accessToken: string; expiresAtMs: number };

const tokenCache = new Map<string, TokenCache>();

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function phonepeBase(environment: PhonePeKeys["environment"]): string {
  return environment === "production"
    ? "https://api.phonepe.com/apis/pg"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox";
}

function oauthBase(environment: PhonePeKeys["environment"]): string {
  return environment === "production"
    ? "https://api.phonepe.com/apis/identity-manager"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox";
}

export function phonepeError(data: unknown, text: string, status: number): string {
  const record = asRecord(data);
  const message = record?.message ?? record?.error ?? record?.code;
  if (typeof message === "string" && message.trim()) return message;
  return text.slice(0, 240) || `HTTP ${status}`;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function phonepeConfig(): Promise<PhonePeKeys | { error: string }> {
  return phonepeKeys();
}

export async function phonepeConfigs(): Promise<PhonePeKeys[]> {
  return phonepeKeySets();
}

async function accessToken(cfg: PhonePeKeys): Promise<string | { error: string }> {
  const cacheKey = `${cfg.environment}:${cfg.clientId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAtMs > Date.now() + 60_000) return cached.accessToken;

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_version: cfg.clientVersion || "1",
    client_secret: cfg.clientSecret,
    grant_type: "client_credentials",
  });
  const res = await fetch(`${oauthBase(cfg.environment)}/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  const row = asRecord(data);
  const token = typeof row?.access_token === "string" ? row.access_token.trim() : "";
  if (!res.ok || !token) {
    return { error: `PhonePe auth failed: ${phonepeError(data, text, res.status)}` };
  }
  const expiresAtSec = Number(row?.expires_at ?? 0);
  const expiresAtMs = Number.isFinite(expiresAtSec) && expiresAtSec > 1_000_000_000
    ? expiresAtSec * 1000
    : Date.now() + 50 * 60 * 1000;
  tokenCache.set(cacheKey, { accessToken: token, expiresAtMs });
  return token;
}

export async function phonepeFetch(
  cfg: PhonePeKeys,
  path: string,
  init: { method: string; body?: unknown }
): Promise<{ ok: boolean; status: number; data: unknown; text: string }> {
  const token = await accessToken(cfg);
  if (typeof token !== "string") {
    return { ok: false, status: 503, data: { message: token.error }, text: token.error };
  }
  const res = await fetch(`${phonepeBase(cfg.environment)}${path}`, {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `O-Bearer ${token}`,
      "X-MERCHANT-ID": cfg.merchantId,
    },
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

export type PhonePeMeta = {
  profileId: string;
  planCode: string;
  credits: number;
  premiumDays: number;
  amountPaise: number;
};

export function phonepeMeta(input: PhonePeMeta): Record<string, string> {
  return {
    udf1: input.profileId,
    udf2: input.planCode.slice(0, 256),
    udf3: String(input.credits),
    udf4: String(input.premiumDays),
    udf5: String(input.amountPaise),
  };
}

export function metaFromPhonePe(meta: unknown): PhonePeMeta | null {
  const row = asRecord(meta);
  if (!row) return null;
  const profileId = String(row.udf1 ?? "").trim();
  const amountPaise = Number.parseInt(String(row.udf5 ?? ""), 10);
  const credits = Number.parseInt(String(row.udf3 ?? "0"), 10);
  const premiumDays = Number.parseInt(String(row.udf4 ?? "0"), 10);
  if (!profileId || !Number.isFinite(amountPaise) || amountPaise < 100) return null;
  return {
    profileId,
    planCode: String(row.udf2 ?? ""),
    credits: Number.isFinite(credits) && credits > 0 ? credits : 0,
    premiumDays: Number.isFinite(premiumDays) && premiumDays > 0 ? premiumDays : 0,
    amountPaise,
  };
}

/** Safe merchant order id for PhonePe (max 63, only _ and -). */
export function phonepeMerchantOrderId(profileId: string): string {
  const stamp = Date.now().toString(36);
  const id = profileId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
  return `mgpp-${id}-${stamp}`.slice(0, 63);
}

export function phonepeMerchantSubscriptionId(profileId: string): string {
  const stamp = Date.now().toString(36);
  const id = profileId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 18);
  return `mgps-${id}-${stamp}`.slice(0, 63);
}

export function phonepeSubscriptionStoredId(merchantSubscriptionId: string): string {
  const raw = merchantSubscriptionId.trim();
  if (raw.startsWith("ppsub_")) return raw.slice(0, 250);
  return `ppsub_${raw}`.slice(0, 250);
}

export function phonepeMerchantSubscriptionIdFromStored(stored: string): string {
  let id = stored.trim();
  while (id.startsWith("ppsub_")) id = id.slice(6);
  return id.trim();
}

function phonepeFrequency(billingPeriod: string | null | undefined): string {
  const p = String(billingPeriod ?? "monthly").toLowerCase();
  if (p === "yearly") return "YEARLY";
  if (p === "quarterly") return "QUARTERLY";
  if (p === "weekly") return "WEEKLY";
  return "MONTHLY";
}

/** Mandate expiry — up to 30 years per PhonePe. */
function phonepeMandateExpireAtMs(): number {
  return Date.now() + 10 * 365 * 24 * 3600 * 1000;
}

type SubscriptionDetailsBody = Record<string, unknown>;

function buildSubscriptionDetails(input: {
  merchantSubscriptionId: string;
  amountPaise: number;
  billingPeriod: string | null | undefined;
  sdk: boolean;
}): SubscriptionDetailsBody {
  const details: SubscriptionDetailsBody = {
    subscriptionType: "RECURRING",
    merchantSubscriptionId: input.merchantSubscriptionId,
    authWorkflowType: "TRANSACTION",
    amountType: "FIXED",
    maxAmount: input.amountPaise,
    frequency: phonepeFrequency(input.billingPeriod),
    expireAt: phonepeMandateExpireAtMs(),
  };
  if (input.sdk) details.productType = "UPI_MANDATE";
  return details;
}

export async function createPhonePeSdkSubscription(
  cfg: PhonePeKeys,
  input: {
    merchantOrderId: string;
    merchantSubscriptionId: string;
    amountPaise: number;
    billingPeriod: string | null | undefined;
    meta: PhonePeMeta;
  }
): Promise<
  | { ok: true; orderId: string; token: string; merchantOrderId: string; merchantSubscriptionId: string }
  | { ok: false; error: string; status: 502 | 503 }
> {
  const created = await phonepeFetch(cfg, "/checkout/v2/sdk/order", {
    method: "POST",
    body: {
      merchantOrderId: input.merchantOrderId,
      amount: input.amountPaise,
      expireAfter: 1200,
      metaInfo: phonepeMeta(input.meta),
      paymentFlow: {
        type: "SUBSCRIPTION_CHECKOUT_SETUP",
        subscriptionDetails: buildSubscriptionDetails({
          merchantSubscriptionId: input.merchantSubscriptionId,
          amountPaise: input.amountPaise,
          billingPeriod: input.billingPeriod,
          sdk: true,
        }),
      },
    },
  });
  const body = asRecord(created.data);
  const orderId = String(body?.orderId ?? "").trim();
  const token = String(body?.token ?? "").trim();
  if (!created.ok || !orderId || !token) {
    return {
      ok: false,
      error: `Could not start PhonePe subscription: ${phonepeError(created.data, created.text, created.status)}`,
      status: 502,
    };
  }
  return {
    ok: true,
    orderId,
    token,
    merchantOrderId: input.merchantOrderId,
    merchantSubscriptionId: input.merchantSubscriptionId,
  };
}

export async function createPhonePeWebSubscription(
  cfg: PhonePeKeys,
  input: {
    merchantOrderId: string;
    merchantSubscriptionId: string;
    amountPaise: number;
    billingPeriod: string | null | undefined;
    meta: PhonePeMeta;
    redirectUrl: string;
  }
): Promise<
  | { ok: true; orderId: string; redirectUrl: string; merchantOrderId: string; merchantSubscriptionId: string }
  | { ok: false; error: string; status: 502 | 503 }
> {
  const created = await phonepeFetch(cfg, "/checkout/v2/pay", {
    method: "POST",
    body: {
      merchantOrderId: input.merchantOrderId,
      amount: input.amountPaise,
      expireAfter: 1200,
      metaInfo: phonepeMeta(input.meta),
      paymentFlow: {
        type: "SUBSCRIPTION_CHECKOUT_SETUP",
        merchantUrls: { redirectUrl: input.redirectUrl },
        subscriptionDetails: buildSubscriptionDetails({
          merchantSubscriptionId: input.merchantSubscriptionId,
          amountPaise: input.amountPaise,
          billingPeriod: input.billingPeriod,
          sdk: false,
        }),
      },
    },
  });
  const body = asRecord(created.data);
  const orderId = String(body?.orderId ?? "").trim();
  const redirectUrl = String(body?.redirectUrl ?? "").trim();
  if (!created.ok || !orderId || !redirectUrl) {
    return {
      ok: false,
      error: `Could not start PhonePe subscription: ${phonepeError(created.data, created.text, created.status)}`,
      status: 502,
    };
  }
  return {
    ok: true,
    orderId,
    redirectUrl,
    merchantOrderId: input.merchantOrderId,
    merchantSubscriptionId: input.merchantSubscriptionId,
  };
}

export async function phonepeSubscriptionStatus(
  cfg: PhonePeKeys,
  merchantSubscriptionId: string
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string; status: 502 }> {
  const id = merchantSubscriptionId.trim();
  if (!id) {
    return { ok: false, error: "PhonePe subscription id is missing.", status: 502 };
  }
  const encoded = encodeURIComponent(id);
  let res = await phonepeFetch(cfg, `/subscriptions/v2/${encoded}/status`, { method: "GET" });
  if (!res.ok) {
    res = await phonepeFetch(cfg, `/checkout/v2/subscriptions/${encoded}/status`, { method: "GET" });
  }
  const data = asRecord(res.data);
  if (!res.ok || !data) {
    return {
      ok: false,
      error: `Could not load PhonePe subscription status: ${phonepeError(res.data, res.text, res.status)}`,
      status: 502,
    };
  }
  return { ok: true, data };
}

/** PhonePe cancel URLs take the merchant subscription id, not the gateway `OMS…` id. */
function isMerchantCancelId(value: string): boolean {
  const v = value.trim();
  if (v.length < 6) return false;
  if (/^OMS/i.test(v)) return false;
  return true;
}

function phonepePathSegment(id: string): string {
  const trimmed = id.trim();
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  return encodeURIComponent(trimmed);
}

function phonePeGatewayId(data: Record<string, unknown> | null | undefined): string {
  if (!data) return "";
  return String(data.subscriptionId ?? data.id ?? "").trim();
}

async function phonepeCancelOnPaths(
  cfg: PhonePeKeys,
  merchantSubscriptionId: string
): Promise<{ ok: true } | { ok: false; error: string; status: 502 }> {
  const segment = phonepePathSegment(merchantSubscriptionId);
  const paths = [
    `/subscriptions/v2/${segment}/cancel`,
    `/checkout/v2/subscriptions/${segment}/cancel`,
  ];
  let last = "Could not reach PhonePe.";
  for (const path of paths) {
    const res = await phonepeFetch(cfg, path, { method: "POST" });
    if (res.status === 204 || res.status === 200 || res.ok) return { ok: true };
    last = phonepeError(res.data, res.text, res.status);
  }
  return {
    ok: false,
    error: `Could not cancel PhonePe subscription: ${last}`,
    status: 502,
  };
}

export async function cancelPhonePeSubscription(
  cfg: PhonePeKeys,
  merchantSubscriptionId: string
): Promise<{ ok: true } | { ok: false; error: string; status: 400 | 502 | 503 }> {
  const id = merchantSubscriptionId.trim();
  if (!id) {
    return { ok: false, error: "This membership is missing the PhonePe subscription id.", status: 400 };
  }
  if (!cfg.merchantId.trim()) {
    return { ok: false, error: "PhonePe merchant id is not configured in admin.", status: 503 };
  }
  return phonepeCancelOnPaths(cfg, id);
}

function merchantSubscriptionIdFromOrder(data: Record<string, unknown>): string {
  const flow = asRecord(data.paymentFlow);
  const nested = asRecord(flow?.subscriptionDetails);
  return String(
    nested?.merchantSubscriptionId ??
      flow?.merchantSubscriptionId ??
      data.merchantSubscriptionId ??
      data.subscriptionId ??
      ""
  ).trim();
}

function normalizeMerchantSubscriptionId(value: string | undefined | null): string {
  return String(value ?? "")
    .trim()
    .replace(/^ppsub_/, "");
}

export async function fulfillPhonePeSubscriptionSetup(
  cfg: PhonePeKeys,
  merchantOrderId: string,
  expectedProfileId?: string,
  merchantSubscriptionIdHint?: string
): Promise<FulfillResult> {
  const loaded = await phonepeOrderStatus(cfg, merchantOrderId, { details: true });
  if (!loaded.ok) return loaded;
  const state = String(loaded.data.state ?? "").toUpperCase();
  if (state !== "COMPLETED") {
    return { ok: false, error: "Subscription setup is not confirmed yet.", status: 400 };
  }
  const flow = asRecord(loaded.data.paymentFlow);
  const flowType = String(flow?.type ?? "").toUpperCase();
  const merchantSubscriptionId =
    merchantSubscriptionIdFromOrder(loaded.data) ||
    normalizeMerchantSubscriptionId(merchantSubscriptionIdHint);
  if (!merchantSubscriptionId) {
    if (flowType && flowType !== "SUBSCRIPTION_CHECKOUT_SETUP") {
      return { ok: false, error: "This is not a PhonePe subscription setup order.", status: 400 };
    }
    return { ok: false, error: "This payment is missing PhonePe subscription details.", status: 400 };
  }
  const notes = metaFromPhonePe(loaded.data.metaInfo);
  if (!notes) return { ok: false, error: "This payment is missing Mangalam payment details.", status: 400 };
  if (expectedProfileId && notes.profileId !== expectedProfileId) {
    return { ok: false, error: "This payment does not belong to this account.", status: 403 };
  }
  const sub = await phonepeSubscriptionStatus(cfg, merchantSubscriptionId);
  if (!sub.ok) return sub;
  const subState = String(sub.data.state ?? "").toUpperCase();
  if (subState !== "ACTIVE" && subState !== "ACTIVATION_IN_PROGRESS") {
    return { ok: false, error: "PhonePe subscription is not active yet.", status: 400 };
  }
  const phonePeGatewaySubId = phonePeGatewayId(sub.data);
  const details = Array.isArray(loaded.data.paymentDetails) ? loaded.data.paymentDetails : [];
  const success = details.find((item) => String(asRecord(item)?.state ?? "").toUpperCase() === "COMPLETED");
  const txn = asRecord(success)?.transactionId;
  const paymentId = txn ? `pp_${txn}` : `ppsetup_${merchantOrderId}`;
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
    subscriptionId: phonepeSubscriptionStoredId(merchantSubscriptionId),
    razorpayPlanId: phonePeGatewaySubId || null,
    status: "active",
    periodEnd,
  });
  return { ok: true, already: applied.already };
}

export async function fulfillPhonePeSubscriptionSetupResolved(
  merchantOrderId: string,
  expectedProfileId?: string,
  merchantSubscriptionIdHint?: string
): Promise<FulfillResult> {
  const configs = await phonepeConfigs();
  if (configs.length === 0) {
    const cfg = await phonepeConfig();
    return { ok: false, error: "error" in cfg ? cfg.error : "PhonePe is not configured.", status: 503 };
  }
  let last: FulfillResult | null = null;
  for (const cfg of configs) {
    const applied = await fulfillPhonePeSubscriptionSetup(
      cfg,
      merchantOrderId,
      expectedProfileId,
      merchantSubscriptionIdHint
    );
    if (applied.ok) return applied;
    if (applied.status !== 502) return applied;
    last = applied;
  }
  return last ?? { ok: false, error: "Could not reach PhonePe.", status: 503 };
}

export async function fulfillPhonePeSubscriptionById(
  cfg: PhonePeKeys,
  merchantSubscriptionId: string,
  expectedProfileId?: string
): Promise<FulfillResult> {
  const merchantSubscriptionIdNorm = normalizeMerchantSubscriptionId(merchantSubscriptionId);
  const sub = await phonepeSubscriptionStatus(cfg, merchantSubscriptionIdNorm);
  if (!sub.ok) return sub;
  const subState = String(sub.data.state ?? "").toUpperCase();
  if (subState === "ACTIVATION_IN_PROGRESS") {
    return { ok: false, error: "Subscription setup is not confirmed yet.", status: 400 };
  }
  if (subState !== "ACTIVE") {
    return { ok: false, error: "PhonePe subscription is not active yet.", status: 400 };
  }
  const sb = (await import("./supabase.js")).getSupabaseAdmin();
  const stored = phonepeSubscriptionStoredId(merchantSubscriptionIdNorm);
  const { data: row } = await sb
    .from("member_subscriptions")
    .select("profile_id,plan_code,status")
    .eq("razorpay_subscription_id", stored)
    .maybeSingle();
  const profileId = row?.profile_id ?? expectedProfileId;
  if (!profileId) {
    return { ok: false, error: "Subscription setup is not confirmed yet.", status: 400 };
  }
  if (expectedProfileId && profileId !== expectedProfileId) {
    return { ok: false, error: "This subscription does not belong to this account.", status: 403 };
  }

  const { data: wallet } = await sb
    .from("wallets")
    .select("premium_until")
    .eq("profile_id", profileId)
    .maybeSingle();
  const untilMs = wallet?.premium_until ? new Date(wallet.premium_until as string).getTime() : 0;
  if (row?.status === "active" && Number.isFinite(untilMs) && untilMs > Date.now()) {
    return { ok: true, already: true };
  }

  const planCode = row?.plan_code ? String(row.plan_code) : "";
  if (!planCode) {
    return { ok: false, error: "Subscription setup is not confirmed yet.", status: 400 };
  }
  const { data: plan } = await sb
    .from("plans")
    .select("code,price_paise,credits,duration_days,billing_period,plan_type")
    .eq("code", planCode)
    .maybeSingle();
  if (!plan) return { ok: false, error: "Plan not found.", status: 404 };

  const credits = Math.max(0, Number(plan.credits) || 0);
  const premiumDays = accessDays(plan);
  const amountPaise = Number(plan.price_paise);
  if (!Number.isFinite(amountPaise) || amountPaise < 100) {
    return { ok: false, error: "This membership has an invalid price.", status: 400 };
  }
  const paymentId = `ppsub_${merchantSubscriptionIdNorm}`;
  const applied = await applyCharge({
    paymentId,
    profileId: String(profileId),
    credits,
    premiumDays,
    amountPaise,
    planCode,
  });
  if (!applied.ok) return applied;
  const periodEnd = new Date(Date.now() + premiumDays * 24 * 3600 * 1000).toISOString();
  const phonePeGatewaySubId = phonePeGatewayId(sub.data);
  await saveSubscription({
    profileId: String(profileId),
    planCode,
    subscriptionId: stored,
    razorpayPlanId: phonePeGatewaySubId || null,
    status: "active",
    periodEnd,
  });
  return { ok: true, already: applied.already };
}

export async function fulfillPhonePeRedemption(
  cfg: PhonePeKeys,
  payload: Record<string, unknown>
): Promise<void> {
  const state = String(payload.state ?? "").toUpperCase();
  if (state !== "COMPLETED") return;
  const notes = metaFromPhonePe(payload.metaInfo);
  const flow = asRecord(payload.paymentFlow);
  const merchantSubscriptionId = String(flow?.merchantSubscriptionId ?? "").trim();
  if (!notes && !merchantSubscriptionId) return;

  const details = Array.isArray(payload.paymentDetails) ? payload.paymentDetails : [];
  const success = details.find((item) => String(asRecord(item)?.state ?? "").toUpperCase() === "COMPLETED");
  const txn = asRecord(success)?.transactionId;
  const amount = Number(payload.amount ?? asRecord(success)?.amount ?? 0);

  let profileId = notes?.profileId ?? "";
  let planCode = notes?.planCode ?? "";
  let credits = notes?.credits ?? 0;
  let premiumDays = notes?.premiumDays ?? 0;
  let amountPaise = notes?.amountPaise ?? (Number.isFinite(amount) ? amount : 0);

  if (!profileId && merchantSubscriptionId) {
    const sb = (await import("./supabase.js")).getSupabaseAdmin();
    const { data: subRow } = await sb
      .from("member_subscriptions")
      .select("profile_id,plan_code")
      .eq("razorpay_subscription_id", phonepeSubscriptionStoredId(merchantSubscriptionId))
      .maybeSingle();
    if (subRow?.profile_id) profileId = String(subRow.profile_id);
    if (subRow?.plan_code) planCode = String(subRow.plan_code);
    if (!premiumDays && planCode) {
      const { data: plan } = await sb.from("plans").select("duration_days,billing_period,credits,price_paise").eq("code", planCode).maybeSingle();
      if (plan) {
        premiumDays = Number(plan.duration_days) || 30;
        credits = Math.max(0, Number(plan.credits) || 0);
        amountPaise = Number(plan.price_paise) || amountPaise;
      }
    }
  }
  if (!profileId || amountPaise < 100) return;

  const paymentId = txn ? `pp_${txn}` : `ppred_${String(payload.merchantOrderId ?? Date.now())}`;
  const applied = await applyCharge({
    paymentId,
    profileId,
    credits,
    premiumDays,
    amountPaise,
    planCode: planCode || null,
  });
  if (!applied.ok) return;
  if (planCode && premiumDays > 0) {
    const periodEnd = new Date(Date.now() + premiumDays * 24 * 3600 * 1000).toISOString();
    await saveSubscription({
      profileId,
      planCode,
      subscriptionId: merchantSubscriptionId
        ? phonepeSubscriptionStoredId(merchantSubscriptionId)
        : phonepeSubscriptionStoredId(`red_${paymentId}`),
      razorpayPlanId: null,
      status: "active",
      periodEnd,
    });
  }
}

function phonePeCancelLookupError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("template with name") ||
    lower.includes("not found") ||
    lower.includes("does not exist") ||
    lower.includes("no such")
  );
}

export async function cancelPhonePeSubscriptionResolved(
  storedSubscriptionId: string,
  hints?: { gatewaySubscriptionId?: string | null }
): Promise<
  | { ok: true }
  | { ok: false; error: string; status: 400 | 502 | 503; localPeriodEndOnly?: boolean }
> {
  let merchantSubscriptionId = phonepeMerchantSubscriptionIdFromStored(storedSubscriptionId);
  if (!merchantSubscriptionId || merchantSubscriptionId.length < 6) {
    return {
      ok: false,
      error: "This membership is missing the PhonePe subscription id. Contact support if this continues.",
      status: 400,
    };
  }
  const configs = await phonepeConfigs();
  if (configs.length === 0) {
    const cfg = await phonepeConfig();
    return { ok: false, error: "error" in cfg ? cfg.error : "PhonePe is not configured.", status: 503 };
  }
  const extraGatewayId = String(hints?.gatewaySubscriptionId ?? "").trim();
  let last: { ok: false; error: string; status: 400 | 502 | 503 } | null = null;
  for (const cfg of configs) {
    if (!cfg.merchantId.trim()) continue;
    const status = await phonepeSubscriptionStatus(cfg, merchantSubscriptionId);
    if (status.ok) {
      const state = String(status.data.state ?? "").toUpperCase();
      if (state === "CANCELLED" || state === "REVOKED" || state === "CANCEL_IN_PROGRESS") {
        return { ok: true };
      }
      const fromStatus = String(status.data.merchantSubscriptionId ?? "").trim();
      if (fromStatus && fromStatus !== merchantSubscriptionId) {
        merchantSubscriptionId = fromStatus;
      }
    }
    const idCandidates = [
      ...new Set([merchantSubscriptionId, extraGatewayId].filter((v) => isMerchantCancelId(v))),
    ];
    for (const candidate of idCandidates) {
      const cancelled = await cancelPhonePeSubscription(cfg, candidate);
      if (cancelled.ok) return cancelled;
      last = cancelled;
      if (cancelled.status !== 502) return cancelled;
      if (!phonePeCancelLookupError(cancelled.error)) return cancelled;
    }
  }
  for (const cfg of configs) {
    const status = await phonepeSubscriptionStatus(cfg, merchantSubscriptionId);
    if (!status.ok) continue;
    const state = String(status.data.state ?? "").toUpperCase();
    if (state === "ACTIVE" || state === "ACTIVATION_IN_PROGRESS") {
      return {
        ok: false,
        error:
          "Renewal will stop in Mangalam after this period. If PhonePe still shows autopay, turn it off in your UPI app.",
        status: 502,
        localPeriodEndOnly: true,
      };
    }
  }
  return last ?? { ok: false, error: "Could not reach PhonePe.", status: 502 };
}

export async function createPhonePeSdkOrder(
  cfg: PhonePeKeys,
  input: {
    merchantOrderId: string;
    amountPaise: number;
    meta: PhonePeMeta;
  }
): Promise<
  | { ok: true; orderId: string; token: string; merchantOrderId: string }
  | { ok: false; error: string; status: 502 | 503 }
> {
  const created = await phonepeFetch(cfg, "/checkout/v2/sdk/order", {
    method: "POST",
    body: {
      merchantOrderId: input.merchantOrderId,
      amount: input.amountPaise,
      expireAfter: 1200,
      metaInfo: phonepeMeta(input.meta),
      paymentFlow: { type: "PG_CHECKOUT" },
    },
  });
  const body = asRecord(created.data);
  const orderId = String(body?.orderId ?? "").trim();
  const token = String(body?.token ?? "").trim();
  if (!created.ok || !orderId || !token) {
    return {
      ok: false,
      error: `Could not start PhonePe checkout: ${phonepeError(created.data, created.text, created.status)}`,
      status: 502,
    };
  }
  return { ok: true, orderId, token, merchantOrderId: input.merchantOrderId };
}

export async function createPhonePeWebPay(
  cfg: PhonePeKeys,
  input: {
    merchantOrderId: string;
    amountPaise: number;
    meta: PhonePeMeta;
    redirectUrl: string;
  }
): Promise<
  | { ok: true; orderId: string; redirectUrl: string; merchantOrderId: string }
  | { ok: false; error: string; status: 502 | 503 }
> {
  const created = await phonepeFetch(cfg, "/checkout/v2/pay", {
    method: "POST",
    body: {
      merchantOrderId: input.merchantOrderId,
      amount: input.amountPaise,
      expireAfter: 1200,
      metaInfo: phonepeMeta(input.meta),
      paymentFlow: {
        type: "PG_CHECKOUT",
        merchantUrls: { redirectUrl: input.redirectUrl },
      },
    },
  });
  const body = asRecord(created.data);
  const orderId = String(body?.orderId ?? "").trim();
  const redirectUrl = String(body?.redirectUrl ?? "").trim();
  if (!created.ok || !orderId || !redirectUrl) {
    return {
      ok: false,
      error: `Could not start PhonePe checkout: ${phonepeError(created.data, created.text, created.status)}`,
      status: 502,
    };
  }
  return { ok: true, orderId, redirectUrl, merchantOrderId: input.merchantOrderId };
}

export async function phonepeOrderStatus(
  cfg: PhonePeKeys,
  merchantOrderId: string,
  options?: { details?: boolean }
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string; status: 502 }> {
  const details = options?.details === true ? "true" : "false";
  const res = await phonepeFetch(
    cfg,
    `/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status?details=${details}`,
    { method: "GET" }
  );
  const data = asRecord(res.data);
  if (!res.ok || !data) {
    return {
      ok: false,
      error: `Could not load PhonePe order status: ${phonepeError(res.data, res.text, res.status)}`,
      status: 502,
    };
  }
  return { ok: true, data };
}

function timingEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let miss = 0;
  for (let i = 0; i < left.length; i++) miss |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return miss === 0;
}

async function hmacSha256(secret: string, body: string): Promise<{ hex: string; base64: string }> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  let binary = "";
  for (const b of mac) binary += String.fromCharCode(b);
  return { hex, base64: btoa(binary) };
}

async function verifyPhonePeSha(
  cfg: PhonePeKeys,
  authorizationHeader: string
): Promise<boolean> {
  if (!cfg.webhookUsername || !cfg.webhookPassword || !authorizationHeader) return false;
  const expected = await sha256Hex(`${cfg.webhookUsername}:${cfg.webhookPassword}`);
  const sent = authorizationHeader.trim().replace(/^sha256\s+/i, "").trim().toLowerCase();
  return sent.length > 0 && timingEqual(sent, expected.toLowerCase());
}

async function verifyPhonePeHmac(
  cfg: PhonePeKeys,
  input: { rawBody: string; keyId: string; signature: string }
): Promise<boolean> {
  if (!cfg.webhookSecret || !input.signature || !input.rawBody) return false;
  // Optional: username field stores PhonePe webhook / checksum key id.
  if (cfg.webhookUsername && input.keyId && cfg.webhookUsername !== input.keyId) return false;
  const mac = await hmacSha256(cfg.webhookSecret, input.rawBody);
  const sent = input.signature.trim();
  const lower = sent.toLowerCase();
  return (
    timingEqual(lower, mac.hex) ||
    timingEqual(lower, `sha256=${mac.hex}`) ||
    timingEqual(sent, mac.base64)
  );
}

/** Accepts PhonePe SHA (Authorization) or HMAC (checksum headers) webhooks. */
export async function verifyPhonePeWebhook(
  cfg: PhonePeKeys,
  input: {
    authorizationHeader: string;
    rawBody: string;
    checksumKeyId?: string;
    checksumSignature?: string;
  }
): Promise<boolean> {
  const keyId = (input.checksumKeyId ?? "").trim();
  const signature = (input.checksumSignature ?? "").trim();
  if (signature && (await verifyPhonePeHmac(cfg, { rawBody: input.rawBody, keyId, signature }))) {
    return true;
  }
  return verifyPhonePeSha(cfg, input.authorizationHeader);
}

type FulfillResult =
  | { ok: true; already: boolean }
  | { ok: false; error: string; status: 400 | 403 | 404 | 500 | 502 | 503 };

export async function fulfillPhonePeOrder(
  cfg: PhonePeKeys,
  merchantOrderId: string,
  expectedProfileId?: string
): Promise<FulfillResult> {
  const loaded = await phonepeOrderStatus(cfg, merchantOrderId);
  if (!loaded.ok) return loaded;
  const state = String(loaded.data.state ?? "").toUpperCase();
  if (state !== "COMPLETED") {
    return { ok: false, error: "Payment is not confirmed yet.", status: 400 };
  }
  const notes = metaFromPhonePe(loaded.data.metaInfo);
  if (!notes) return { ok: false, error: "This payment is missing Mangalam payment details.", status: 400 };
  if (expectedProfileId && notes.profileId !== expectedProfileId) {
    return { ok: false, error: "This payment does not belong to this account.", status: 403 };
  }
  const amount = Number(loaded.data.amount ?? 0);
  if (Number.isFinite(amount) && amount > 0 && amount !== notes.amountPaise) {
    return { ok: false, error: "The paid amount does not match the plan.", status: 400 };
  }
  const details = Array.isArray(loaded.data.paymentDetails) ? loaded.data.paymentDetails : [];
  const success = details.find((item) => String(asRecord(item)?.state ?? "").toUpperCase() === "COMPLETED");
  const txn = asRecord(success)?.transactionId;
  const paymentId = txn ? `pp_${txn}` : `pporder_${merchantOrderId}`;
  const applied = await applyCharge({
    paymentId,
    profileId: notes.profileId,
    credits: notes.credits,
    premiumDays: notes.premiumDays,
    amountPaise: notes.amountPaise,
    planCode: notes.planCode || null,
  });
  if (!applied.ok) return applied;
  // one_time premium only — recurring membership uses SUBSCRIPTION_CHECKOUT_SETUP.
  return { ok: true, already: applied.already };
}

export async function fulfillPhonePeOrderResolved(
  merchantOrderId: string,
  expectedProfileId?: string
): Promise<FulfillResult> {
  const configs = await phonepeConfigs();
  if (configs.length === 0) {
    const cfg = await phonepeConfig();
    return { ok: false, error: "error" in cfg ? cfg.error : "PhonePe is not configured.", status: 503 };
  }
  let last: FulfillResult | null = null;
  for (const cfg of configs) {
    const applied = await fulfillPhonePeOrder(cfg, merchantOrderId, expectedProfileId);
    if (applied.ok) return applied;
    if (applied.status !== 502) return applied;
    last = applied;
  }
  return last ?? { ok: false, error: "Could not reach PhonePe.", status: 503 };
}

/** After Standard Checkout or subscription setup Pay Page / SDK return. */
export async function fulfillPhonePeCheckoutResolved(
  merchantOrderId: string,
  expectedProfileId?: string
): Promise<FulfillResult> {
  const sub = await fulfillPhonePeSubscriptionSetupResolved(merchantOrderId, expectedProfileId);
  if (sub.ok) return sub;
  if (sub.status === 403) return sub;
  return fulfillPhonePeOrderResolved(merchantOrderId, expectedProfileId);
}

export function phonepeCheckoutScript(environment: PhonePeKeys["environment"]): string {
  return environment === "production"
    ? "https://mercury.phonepe.com/web/bundle/checkout.js"
    : "https://mercury-stg.phonepe.com/web/bundle/checkout.js";
}

export function phonepeRedirectBase(): string {
  return env("PHONEPE_RETURN_URL")?.trim() || "https://mangalam-web-beta.vercel.app/membership";
}
