import { env } from "./env.js";
import { getSupabaseAdmin } from "./supabase.js";

/** Shared by every external service that has a test pair and a live pair. */
export type ServiceMode = "sandbox" | "production";

export type CashfreeKeys = {
  clientId: string;
  clientSecret: string;
  environment: ServiceMode;
};

export type RazorpayKeys = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  pricePaisePerCredit: number;
};

export type PhonePeKeys = {
  merchantId: string;
  clientId: string;
  clientVersion: string;
  clientSecret: string;
  /** SHA auth username, or HMAC webhook / checksum key id. */
  webhookUsername: string;
  /** SHA auth password. */
  webhookPassword: string;
  /** HMAC auth secret from PhonePe webhook create. */
  webhookSecret: string;
  environment: ServiceMode;
};

const SETTINGS_SELECT = [
  "integrations_live",
  "cashfree_sandbox_client_id",
  "cashfree_sandbox_client_secret",
  "cashfree_live_client_id",
  "cashfree_live_client_secret",
  "cashfree_client_id",
  "cashfree_client_secret",
  "cashfree_environment",
  "razorpay_test_key_id",
  "razorpay_test_key_secret",
  "razorpay_test_webhook_secret",
  "razorpay_live_key_id",
  "razorpay_live_key_secret",
  "razorpay_live_webhook_secret",
  "razorpay_key_id",
  "razorpay_key_secret",
  "razorpay_webhook_secret",
  "phonepe_sandbox_merchant_id",
  "phonepe_sandbox_client_id",
  "phonepe_sandbox_client_version",
  "phonepe_sandbox_client_secret",
  "phonepe_sandbox_webhook_username",
  "phonepe_sandbox_webhook_password",
  "phonepe_sandbox_webhook_secret",
  "phonepe_live_merchant_id",
  "phonepe_live_client_id",
  "phonepe_live_client_version",
  "phonepe_live_client_secret",
  "phonepe_live_webhook_username",
  "phonepe_live_webhook_password",
  "phonepe_live_webhook_secret",
].join(",");

type SettingsRow = Record<string, unknown>;

type LoadedSettings =
  | { ready: false }
  | { ready: true; live: boolean; row: SettingsRow };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function missingColumn(message: string): boolean {
  return /column|schema cache/i.test(message);
}

function pricePaise(): number | { error: string } {
  const raw = env("CONTACT_CREDIT_PRICE_PAISE");
  const price = raw ? Number.parseInt(raw, 10) : 100;
  if (!Number.isFinite(price) || price < 1) return { error: "CONTACT_CREDIT_PRICE_PAISE is invalid" };
  return price;
}

async function loadSettings(): Promise<LoadedSettings> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("app_settings")
      .select(SETTINGS_SELECT)
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return { ready: false };
    const row = data as unknown as SettingsRow;
    if (!("integrations_live" in row)) return { ready: false };
    return { ready: true, live: row.integrations_live === true, row };
  } catch {
    return { ready: false };
  }
}

function envCashfree(): CashfreeKeys | null {
  const clientId = env("CASHFREE_CLIENT_ID")?.trim() ?? "";
  const clientSecret = env("CASHFREE_CLIENT_SECRET")?.trim() ?? "";
  if (!clientId || !clientSecret) return null;
  const environment: ServiceMode =
    env("CASHFREE_ENV")?.trim().toLowerCase() === "production" ? "production" : "sandbox";
  return { clientId, clientSecret, environment };
}

function cashfreeFromRow(row: SettingsRow, mode: ServiceMode): CashfreeKeys | null {
  if (mode === "production") {
    const clientId = text(row.cashfree_live_client_id);
    const clientSecret = text(row.cashfree_live_client_secret);
    if (clientId && clientSecret) return { clientId, clientSecret, environment: "production" };
    if (text(row.cashfree_environment) === "production") {
      const legacyId = text(row.cashfree_client_id);
      const legacySecret = text(row.cashfree_client_secret);
      if (legacyId && legacySecret) return { clientId: legacyId, clientSecret: legacySecret, environment: "production" };
    }
  } else {
    const clientId = text(row.cashfree_sandbox_client_id);
    const clientSecret = text(row.cashfree_sandbox_client_secret);
    if (clientId && clientSecret) return { clientId, clientSecret, environment: "sandbox" };
    if (text(row.cashfree_environment) !== "production") {
      const legacyId = text(row.cashfree_client_id);
      const legacySecret = text(row.cashfree_client_secret);
      if (legacyId && legacySecret) return { clientId: legacyId, clientSecret: legacySecret, environment: "sandbox" };
    }
  }
  const fromEnv = envCashfree();
  if (fromEnv && fromEnv.environment === mode) return fromEnv;
  return null;
}

function envRazorpay(): { keyId: string; keySecret: string; webhookSecret: string; mode: ServiceMode } | null {
  const keyId = env("RAZORPAY_KEY_ID")?.trim() ?? "";
  const keySecret = env("RAZORPAY_KEY_SECRET")?.trim() ?? "";
  if (!keyId || !keySecret) return null;
  return {
    keyId,
    keySecret,
    webhookSecret: env("RAZORPAY_WEBHOOK_SECRET")?.trim() ?? "",
    mode: keyId.startsWith("rzp_live_") ? "production" : "sandbox",
  };
}

function razorpayFromRow(
  row: SettingsRow,
  mode: ServiceMode
): { keyId: string; keySecret: string; webhookSecret: string } | null {
  if (mode === "production") {
    const keyId = text(row.razorpay_live_key_id);
    const keySecret = text(row.razorpay_live_key_secret);
    if (keyId && keySecret) {
      return { keyId, keySecret, webhookSecret: text(row.razorpay_live_webhook_secret) };
    }
    const legacyId = text(row.razorpay_key_id);
    if (legacyId.startsWith("rzp_live_") && text(row.razorpay_key_secret)) {
      return {
        keyId: legacyId,
        keySecret: text(row.razorpay_key_secret),
        webhookSecret: text(row.razorpay_webhook_secret),
      };
    }
  } else {
    const keyId = text(row.razorpay_test_key_id);
    const keySecret = text(row.razorpay_test_key_secret);
    if (keyId && keySecret) {
      return { keyId, keySecret, webhookSecret: text(row.razorpay_test_webhook_secret) };
    }
    const legacyId = text(row.razorpay_key_id);
    if (legacyId && !legacyId.startsWith("rzp_live_") && text(row.razorpay_key_secret)) {
      return {
        keyId: legacyId,
        keySecret: text(row.razorpay_key_secret),
        webhookSecret: text(row.razorpay_webhook_secret),
      };
    }
  }
  const fromEnv = envRazorpay();
  if (fromEnv && fromEnv.mode === mode) {
    return { keyId: fromEnv.keyId, keySecret: fromEnv.keySecret, webhookSecret: fromEnv.webhookSecret };
  }
  return null;
}

function webhookFor(webhook: string, mode: ServiceMode): string {
  if (webhook) return webhook;
  const fromEnv = envRazorpay();
  if (fromEnv && fromEnv.mode === mode) return fromEnv.webhookSecret;
  return "";
}

/** Test until the database switch exists. Never turns live on because a column is missing. */
export async function serviceMode(): Promise<ServiceMode> {
  const loaded = await loadSettings();
  if (!loaded.ready) return "sandbox";
  return loaded.live ? "production" : "sandbox";
}

export async function cashfreeKeys(): Promise<CashfreeKeys | { error: string }> {
  const loaded = await loadSettings();
  if (!loaded.ready) {
    const legacy = await legacyCashfree();
    if (legacy) return legacy;
    return { error: "Cashfree is not configured. Add the App ID and Secret Key in admin settings." };
  }
  const mode: ServiceMode = loaded.live ? "production" : "sandbox";
  const picked = cashfreeFromRow(loaded.row, mode);
  if (picked) return picked;
  return {
    error: loaded.live
      ? "Add the live Cashfree App ID and Secret Key in admin settings."
      : "Add the test Cashfree App ID and Secret Key in admin settings.",
  };
}

/** Active mode first, then the other saved pair. Webhooks can arrive for a payment started before the switch. */
export async function cashfreeKeySets(): Promise<CashfreeKeys[]> {
  const loaded = await loadSettings();
  if (!loaded.ready) {
    const legacy = await legacyCashfree();
    return legacy ? [legacy] : [];
  }
  const active = cashfreeFromRow(loaded.row, loaded.live ? "production" : "sandbox");
  const other = cashfreeFromRow(loaded.row, loaded.live ? "sandbox" : "production");
  const sets: CashfreeKeys[] = [];
  if (active) sets.push(active);
  if (other && !sets.some((item) => item.clientId === other.clientId && item.environment === other.environment)) {
    sets.push(other);
  }
  return sets;
}

async function legacyCashfree(): Promise<CashfreeKeys | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("app_settings")
      .select("cashfree_client_id,cashfree_client_secret,cashfree_environment")
      .eq("id", 1)
      .maybeSingle();
    if (!error && data?.cashfree_client_id && data?.cashfree_client_secret) {
      return {
        clientId: String(data.cashfree_client_id).trim(),
        clientSecret: String(data.cashfree_client_secret).trim(),
        environment: String(data.cashfree_environment ?? "").toLowerCase() === "production" ? "production" : "sandbox",
      };
    }
    if (error && !missingColumn(error.message)) return envCashfree();
  } catch {
    return envCashfree();
  }
  return envCashfree();
}

export async function razorpayKeys(): Promise<RazorpayKeys | { error: string }> {
  const sets = await razorpayKeySets();
  if ("error" in sets) return sets;
  const active = sets[0];
  if (active) return active;
  const loaded = await loadSettings();
  if (loaded.ready && loaded.live) return { error: "Add the live Razorpay Key ID and Key Secret in admin settings." };
  if (loaded.ready) return { error: "Add the test Razorpay Key ID and Key Secret in admin settings." };
  return { error: "Razorpay is not configured on the server" };
}

export async function razorpayKeySets(): Promise<RazorpayKeys[] | { error: string }> {
  const price = pricePaise();
  if (typeof price !== "number") return price;
  const loaded = await loadSettings();
  if (!loaded.ready) {
    const legacy = await legacyRazorpay(price);
    return legacy ? [legacy] : [];
  }
  const sets: RazorpayKeys[] = [];
  const order: ServiceMode[] = loaded.live ? ["production", "sandbox"] : ["sandbox", "production"];
  for (const mode of order) {
    const keys = razorpayFromRow(loaded.row, mode);
    if (!keys || sets.some((item) => item.keyId === keys.keyId)) continue;
    sets.push({ ...keys, webhookSecret: webhookFor(keys.webhookSecret, mode), pricePaisePerCredit: price });
  }
  return sets;
}

function phonepeFromRow(row: SettingsRow, mode: ServiceMode): PhonePeKeys | null {
  const prefix = mode === "production" ? "phonepe_live_" : "phonepe_sandbox_";
  const merchantId = text(row[`${prefix}merchant_id`]);
  const clientId = text(row[`${prefix}client_id`]);
  const clientVersion = text(row[`${prefix}client_version`]) || "1";
  const clientSecret = text(row[`${prefix}client_secret`]);
  if (!merchantId || !clientId || !clientSecret) return null;
  return {
    merchantId,
    clientId,
    clientVersion,
    clientSecret,
    webhookUsername: text(row[`${prefix}webhook_username`]),
    webhookPassword: text(row[`${prefix}webhook_password`]),
    webhookSecret: text(row[`${prefix}webhook_secret`]),
    environment: mode,
  };
}

function envPhonePe(): PhonePeKeys | null {
  const merchantId = env("PHONEPE_MERCHANT_ID")?.trim() ?? "";
  const clientId = env("PHONEPE_CLIENT_ID")?.trim() ?? "";
  const clientSecret = env("PHONEPE_CLIENT_SECRET")?.trim() ?? "";
  if (!merchantId || !clientId || !clientSecret) return null;
  const environment: ServiceMode =
    env("PHONEPE_ENV")?.trim().toLowerCase() === "production" ? "production" : "sandbox";
  return {
    merchantId,
    clientId,
    clientVersion: env("PHONEPE_CLIENT_VERSION")?.trim() || "1",
    clientSecret,
    webhookUsername: env("PHONEPE_WEBHOOK_USERNAME")?.trim() ?? "",
    webhookPassword: env("PHONEPE_WEBHOOK_PASSWORD")?.trim() ?? "",
    webhookSecret: env("PHONEPE_WEBHOOK_SECRET")?.trim() ?? "",
    environment,
  };
}

export async function phonepeKeys(): Promise<PhonePeKeys | { error: string }> {
  const loaded = await loadSettings();
  if (!loaded.ready) {
    const fromEnv = envPhonePe();
    if (fromEnv) return fromEnv;
    return { error: "PhonePe is not configured. Add the merchant id and API keys in admin settings." };
  }
  const mode: ServiceMode = loaded.live ? "production" : "sandbox";
  const fromEnv = envPhonePe();
  const picked = phonepeFromRow(loaded.row, mode) ?? (fromEnv?.environment === mode ? fromEnv : null);
  if (picked) return picked;
  return {
    error: loaded.live
      ? "Add the live PhonePe merchant id and API keys in admin settings."
      : "Add the test PhonePe merchant id and API keys in admin settings.",
  };
}

/** Active mode first, then the other saved pair (webhooks can arrive after a mode switch). */
export async function phonepeKeySets(): Promise<PhonePeKeys[]> {
  const loaded = await loadSettings();
  if (!loaded.ready) {
    const fromEnv = envPhonePe();
    return fromEnv ? [fromEnv] : [];
  }
  const sets: PhonePeKeys[] = [];
  const order: ServiceMode[] = loaded.live ? ["production", "sandbox"] : ["sandbox", "production"];
  for (const mode of order) {
    const keys = phonepeFromRow(loaded.row, mode);
    if (!keys || sets.some((item) => item.clientId === keys.clientId && item.environment === keys.environment)) {
      continue;
    }
    sets.push(keys);
  }
  const fromEnv = envPhonePe();
  if (
    fromEnv &&
    !sets.some((item) => item.clientId === fromEnv.clientId && item.environment === fromEnv.environment)
  ) {
    sets.push(fromEnv);
  }
  return sets;
}

async function legacyRazorpay(price: number): Promise<RazorpayKeys | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("app_settings")
      .select("razorpay_key_id,razorpay_key_secret,razorpay_webhook_secret")
      .eq("id", 1)
      .maybeSingle();
    if (!error && data?.razorpay_key_id && data?.razorpay_key_secret) {
      return {
        keyId: String(data.razorpay_key_id).trim(),
        keySecret: String(data.razorpay_key_secret).trim(),
        webhookSecret: text(data.razorpay_webhook_secret) || env("RAZORPAY_WEBHOOK_SECRET")?.trim() || "",
        pricePaisePerCredit: price,
      };
    }
  } catch {
    /* env fallback */
  }
  const fromEnv = envRazorpay();
  if (!fromEnv) return null;
  return {
    keyId: fromEnv.keyId,
    keySecret: fromEnv.keySecret,
    webhookSecret: fromEnv.webhookSecret,
    pricePaisePerCredit: price,
  };
}
