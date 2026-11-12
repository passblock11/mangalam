import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { env } from "../env.js";
import { getSupabaseAdmin } from "../supabase.js";

const orderBodySchema = z
  .object({
    credits: z.number().int().min(1).max(500).optional(),
    plan_code: z.string().min(1).max(60).optional(),
  })
  .refine((v) => v.credits || v.plan_code, "Provide credits or plan_code");

const verifyBodySchema = z
  .object({
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
  })
  .strict();

function razorpayConfig():
  | { keyId: string; keySecret: string; pricePaisePerCredit: number }
  | { error: string } {
  const keyId = env("RAZORPAY_KEY_ID");
  const keySecret = env("RAZORPAY_KEY_SECRET");
  const rawPrice = env("CONTACT_CREDIT_PRICE_PAISE");
  const pricePaisePerCredit = rawPrice ? Number.parseInt(rawPrice, 10) : 100;
  if (!keyId || !keySecret) {
    return { error: "Razorpay is not configured on the server" };
  }
  if (!Number.isFinite(pricePaisePerCredit) || pricePaisePerCredit < 1) {
    return { error: "CONTACT_CREDIT_PRICE_PAISE is invalid" };
  }
  return { keyId, keySecret, pricePaisePerCredit };
}

/** DB-driven Razorpay config (admin-managed) with env-var fallback. */
async function razorpayConfigAsync(): Promise<
  | { keyId: string; keySecret: string; pricePaisePerCredit: number }
  | { error: string }
> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("app_settings")
      .select("razorpay_key_id,razorpay_key_secret,active_payment_method")
      .eq("id", 1)
      .maybeSingle();
    if (data?.razorpay_key_id && data?.razorpay_key_secret) {
      const rawPrice = env("CONTACT_CREDIT_PRICE_PAISE");
      const pricePaisePerCredit = rawPrice ? Number.parseInt(rawPrice, 10) : 100;
      if (!Number.isFinite(pricePaisePerCredit) || pricePaisePerCredit < 1) {
        return { error: "CONTACT_CREDIT_PRICE_PAISE is invalid" };
      }
      return {
        keyId: data.razorpay_key_id,
        keySecret: data.razorpay_key_secret,
        pricePaisePerCredit,
      };
    }
  } catch {
    // ignore DB errors, fall through to env
  }
  return razorpayConfig();
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function basicAuthHeader(keyId: string, keySecret: string): string {
  const pair = `${keyId}:${keySecret}`;
  // Edge / V8: btoa expects Latin1; key id/secret are ASCII.
  return `Basic ${btoa(pair)}`;
}

/**
 * Safely read a Razorpay (or any fetch) response body as JSON. Razorpay
 * occasionally returns an empty body (e.g. 401/403 with no body) or a
 * non-JSON error page, which would otherwise make `await res.json()` throw
 * "Unexpected end of JSON input" and crash the request into a generic 500.
 * Returns { data, text } so the caller can build a meaningful error message.
 */
async function readRazorpay(
  res: Response
): Promise<{ data: Record<string, unknown> | null; text: string; status: number }> {
  const text = await res.text();
  let data: Record<string, unknown> | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = null;
    }
  }
  return { data, text, status: res.status };
}

/** Extract a human-readable description from a Razorpay error payload. */
function razorpayErrorDescription(
  data: Record<string, unknown> | null,
  text: string,
  status: number
): string {
  const err = data?.error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as { description?: string; message?: string; code?: string };
    return e.description ?? e.message ?? e.code ?? `HTTP ${status}`;
  }
  return text || `HTTP ${status}`;
}

type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  notes?: Record<string, string>;
};

type RazorpayPayment = {
  id: string;
  status: string;
  order_id?: string;
  amount?: number;
};

export const paymentsRouter = new Hono();

paymentsRouter.use("*", requireAuth);

// Diagnostic endpoint (auth required) — returns the full upstream
// response so we can see exactly what Razorpay sends back. Does NOT
// create a real order (uses a throwaway receipt + minimal body).
paymentsRouter.get("/razorpay/diagnose", async (c) => {
  const cfg = await razorpayConfigAsync();
  if ("error" in cfg) {
    return c.json({ error: cfg.error }, 503);
  }
  const uid = c.get("userId");
  const reqBody = {
    amount: 100,
    currency: "INR",
    receipt: `mangalam_diag_${uid.slice(0, 8)}_${Date.now()}`,
    notes: { profile_id: uid, diag: "1" },
  };
  const reqHeaders: Record<string, string> = {
    Authorization: basicAuthHeader(cfg.keyId, cfg.keySecret),
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "Mangalam-Backend/1.0",
  };
  let res: Response;
  try {
    res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: reqHeaders,
      body: JSON.stringify(reqBody),
    });
  } catch (e) {
    return c.json({ fetchError: (e as Error).message }, 502);
  }
  const text = await res.text();
  const respHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => { respHeaders[k] = v; });
  return c.json({
    request: {
      url: "https://api.razorpay.com/v1/orders",
      method: "POST",
      headers: { ...reqHeaders, Authorization: `Basic ${cfg.keyId}:***` },
      body: reqBody,
    },
    response: {
      status: res.status,
      statusText: res.statusText,
      headers: respHeaders,
      body: text.slice(0, 2000),
    },
    keyId: cfg.keyId,
  });
});

paymentsRouter.post("/razorpay/order", async (c) => {
  const cfg = await razorpayConfigAsync();
  if ("error" in cfg) {
    return c.json({ error: cfg.error }, 503);
  }
  const uid = c.get("userId");
  const body = await c.req.json().catch(() => null);
  const parsed = orderBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const { credits, plan_code } = parsed.data;

  // Resolve plan if plan_code provided (admin-managed plans table)
  let amountPaise: number;
  let creditGrant = 0;
  let premiumDays = 0;
  let planCodeNote = "";
  if (plan_code) {
    const sb = getSupabaseAdmin();
    type PlanRow = {
      code: string;
      price_paise: number;
      credits: number | null;
      duration_days: number | null;
      plan_type: string;
      is_active: boolean;
    };
    let plan: PlanRow | null = null;
    let planErr: { message?: string } | null = null;
    try {
      const r = await sb
        .from("plans")
        .select("code,name,price_paise,credits,duration_days,plan_type,is_active")
        .eq("code", plan_code)
        .maybeSingle();
      plan = (r.data as PlanRow | null) ?? null;
      planErr = (r.error as { message?: string } | null) ?? null;
    } catch (e) {
      planErr = { message: (e as Error).message };
      console.error("[razorpay/order] plans lookup threw", { plan_code, err: (e as Error).message });
    }
    if (planErr) return c.json({ error: `Plans lookup failed: ${planErr.message}` }, 500);
    if (!plan || !plan.is_active) {
      return c.json({ error: "Plan not found or inactive" }, 404);
    }
    amountPaise = plan.price_paise;
    creditGrant = plan.credits ?? 0;
    premiumDays = plan.plan_type === "subscription" || plan.plan_type === "one_time" ? (plan.duration_days ?? 0) : 0;
    planCodeNote = plan.code;
  } else {
    amountPaise = (credits as number) * cfg.pricePaisePerCredit;
    creditGrant = credits as number;
  }

  if (!Number.isFinite(amountPaise) || amountPaise < 100) {
    return c.json(
      { error: `This plan has an invalid price (${amountPaise}). Please edit the plan in admin settings.` },
      400
    );
  }

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(cfg.keyId, cfg.keySecret),
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Mangalam-Backend/1.0",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: `mangalam_${uid.slice(0, 8)}_${Date.now()}`,
      notes: {
        profile_id: uid,
        credits: String(creditGrant),
        premium_days: String(premiumDays),
        plan_code: planCodeNote,
        price_paise: String(amountPaise),
      },
    }),
  });

  const { data, text, status } = await readRazorpay(res);
  if (!res.ok) {
    const desc = razorpayErrorDescription(data, text, status);
    const respHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { respHeaders[k] = v; });
    console.error("[razorpay/order] upstream error", {
      status,
      amountPaise,
      planCodeNote,
      body: text.slice(0, 500),
      contentType: respHeaders["content-type"] ?? "",
      server: respHeaders["server"] ?? "",
      cfRay: respHeaders["cf-ray"] ?? "",
    });
    return c.json({ error: `Razorpay order failed: ${desc}` }, 502);
  }
  if (!data) {
    console.error("[razorpay/order] empty upstream body", { status });
    return c.json(
      { error: `Razorpay returned an empty response (HTTP ${status}). Check the API keys in admin settings.` },
      502
    );
  }

  const order = data as RazorpayOrder;
  return c.json({
    key_id: cfg.keyId,
    order_id: order.id,
    amount_paise: order.amount,
    currency: order.currency,
    credits: creditGrant,
    premium_days: premiumDays,
    plan_code: planCodeNote || undefined,
  });
});

paymentsRouter.post("/razorpay/verify", async (c) => {
  const cfg = await razorpayConfigAsync();
  if ("error" in cfg) {
    return c.json({ error: cfg.error }, 503);
  }
  const uid = c.get("userId");
  const body = await c.req.json().catch(() => null);
  const parsed = verifyBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  const expectedSig = await hmacSha256Hex(
    cfg.keySecret,
    `${razorpay_order_id}|${razorpay_payment_id}`
  );
  if (expectedSig !== razorpay_signature) {
    return c.json({ error: "Invalid payment signature" }, 400);
  }

  const payRes = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}`,
    {
      headers: { Authorization: basicAuthHeader(cfg.keyId, cfg.keySecret) },
    }
  );
  const payRead = await readRazorpay(payRes);
  const payment = (payRead.data ?? {}) as RazorpayPayment & Record<string, unknown>;
  if (!payRes.ok) {
    console.error("[razorpay/verify] payment fetch error", {
      status: payRead.status,
      body: payRead.text.slice(0, 500),
    });
    return c.json(
      { error: `Could not load payment from Razorpay: ${razorpayErrorDescription(payRead.data, payRead.text, payRead.status)}` },
      502
    );
  }
  if (payment.status !== "captured" && payment.status !== "authorized") {
    return c.json({ error: `Payment not successful (${payment.status})` }, 400);
  }
  if (payment.order_id && payment.order_id !== razorpay_order_id) {
    return c.json({ error: "Payment does not match order" }, 400);
  }

  const ordRes = await fetch(
    `https://api.razorpay.com/v1/orders/${encodeURIComponent(razorpay_order_id)}`,
    {
      headers: { Authorization: basicAuthHeader(cfg.keyId, cfg.keySecret) },
    }
  );
  const ordRead = await readRazorpay(ordRes);
  const order = (ordRead.data ?? {}) as RazorpayOrder & { notes?: Record<string, string> };
  if (!ordRes.ok) {
    console.error("[razorpay/verify] order fetch error", {
      status: ordRead.status,
      body: ordRead.text.slice(0, 500),
    });
    return c.json(
      { error: `Could not load order from Razorpay: ${razorpayErrorDescription(ordRead.data, ordRead.text, ordRead.status)}` },
      502
    );
  }
  const notesProfile = order.notes?.profile_id;
  const notesCredits = order.notes?.credits;
  if (!notesProfile || notesProfile !== uid) {
    return c.json({ error: "Order does not belong to this user" }, 403);
  }
  const credits = Number.parseInt(notesCredits ?? "", 10);
  const premiumDays = Number.parseInt(order.notes?.premium_days ?? "", 10);
  const planCode = order.notes?.plan_code ?? "";
  const notesPrice = Number.parseInt(order.notes?.price_paise ?? "", 10);
  if (!Number.isFinite(credits) || credits < 0) {
    return c.json({ error: "Invalid order metadata" }, 400);
  }

  // Amount check: plan-based orders use notes.price_paise; credit-based use credits * pricePerCredit
  const expectedAmount = planCode
    ? (Number.isFinite(notesPrice) ? notesPrice : order.amount)
    : credits * cfg.pricePaisePerCredit;
  if (order.amount !== expectedAmount) {
    return c.json({ error: "Order amount mismatch" }, 400);
  }
  if (typeof payment.amount === "number" && payment.amount !== order.amount) {
    return c.json({ error: "Payment amount mismatch" }, 400);
  }

  const sb = getSupabaseAdmin();

  const { data: existing } = await sb
    .from("razorpay_payment_credits")
    .select("razorpay_payment_id")
    .eq("razorpay_payment_id", razorpay_payment_id)
    .maybeSingle();

  if (existing) {
    const { data: wallet } = await sb
      .from("wallets")
      .select("*")
      .eq("profile_id", uid)
      .maybeSingle();
    return c.json({
      ok: true,
      already_applied: true,
      wallet: wallet ?? null,
    });
  }

  const { error: insErr } = await sb.from("razorpay_payment_credits").insert({
    razorpay_payment_id,
    profile_id: uid,
    credits,
    amount_paise: order.amount,
    premium_days: Number.isFinite(premiumDays) && premiumDays > 0 ? premiumDays : 0,
    plan_code: planCode || null,
  });
  if (insErr) {
    return c.json({ error: insErr.message }, 500);
  }

  const { data: walletRow, error: wErr } = await sb
    .from("wallets")
    .select("contact_credits,premium_until")
    .eq("profile_id", uid)
    .maybeSingle();
  if (wErr) return c.json({ error: wErr.message }, 500);

  const prev = (walletRow?.contact_credits as number | null) ?? 0;
  const prevPremiumUntil = (walletRow as { premium_until?: string | null } | null)?.premium_until;
  let newPremiumUntil: string | null = prevPremiumUntil ?? null;
  if (Number.isFinite(premiumDays) && premiumDays > 0) {
    const base = prevPremiumUntil && new Date(prevPremiumUntil).getTime() > Date.now()
      ? new Date(prevPremiumUntil).getTime()
      : Date.now();
    newPremiumUntil = new Date(base + premiumDays * 24 * 3600 * 1000).toISOString();
  }
  const { data: wallet, error: upErr } = await sb
    .from("wallets")
    .update({
      contact_credits: prev + credits,
      premium_until: newPremiumUntil,
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", uid)
    .select()
    .maybeSingle();
  if (upErr) return c.json({ error: upErr.message }, 500);

  return c.json({
    ok: true,
    already_applied: false,
    credits_added: credits,
    premium_days_added: Number.isFinite(premiumDays) && premiumDays > 0 ? premiumDays : 0,
    wallet: wallet ?? null,
  });
});
