import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import {
  accessDays,
  applyCharge,
  billingCycle,
  isMissingColumn,
  periodEndIso,
  planKey,
  saveSubscription,
  type MembershipPlan,
} from "../billing.js";
import { memberAccess } from "../contact-access.js";
import { env } from "../env.js";
import { getSupabaseAdmin } from "../supabase.js";

/**
 * Make a Razorpay API call. The Vercel Edge runtime's direct fetch to
 * api.razorpay.com is intercepted and returns HTTP 406 with an empty
 * body (confirmed for real keys, fake keys, and even a no-auth GET).
 * To work around this, when RAZORPAY_PROXY_URL is set we route the call
 * through a Supabase Edge Function proxy (Deno Deploy), which reaches
 * Razorpay normally. The proxy requires X-Proxy-Secret and only
 * forwards to api.razorpay.com (not an open proxy).
 */
async function razorpayFetch(
  path: string,
  init: { method: string; headers: Record<string, string>; body: string }
): Promise<Response> {
  const proxyUrl = env("RAZORPAY_PROXY_URL");
  const proxySecret = env("RAZORPAY_PROXY_SECRET");
  if (proxyUrl && proxySecret) {
    const proxyHeaders: Record<string, string> = {
      "x-proxy-secret": proxySecret,
      "x-target-path": path,
      "content-type": init.headers["Content-Type"] ?? "application/json",
      "accept": init.headers["Accept"] ?? "application/json",
      "user-agent": init.headers["User-Agent"] ?? "Mangalam-Backend/1.0",
    };
    if (init.headers["Authorization"]) {
      proxyHeaders["authorization"] = init.headers["Authorization"];
    }
    return fetch(proxyUrl, {
      method: init.method,
      headers: proxyHeaders,
      body: init.method === "GET" || init.method === "HEAD" ? undefined : init.body,
    });
  }
  // Fallback: direct (will 406 from Edge, but keeps the path working
  // for local dev / non-Vercel environments).
  return fetch(`https://api.razorpay.com${path}`, {
    method: init.method,
    headers: init.headers,
    body: init.method === "GET" || init.method === "HEAD" ? undefined : init.body,
  });
}

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

paymentsRouter.use("*", async (c, next) => {
  if (c.req.path.endsWith("/razorpay/webhook")) return next();
  return requireAuth(c, next);
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
    if (plan.plan_type === "subscription") {
      return c.json(
        {
          error:
            "This is a membership. It renews automatically and must be started from Membership.",
        },
        400
      );
    }
    amountPaise = plan.price_paise;
    creditGrant = plan.credits ?? 0;
    premiumDays = plan.plan_type === "subscription" || plan.plan_type === "one_time" ? (plan.duration_days ?? 0) : 0;
    planCodeNote = plan.code;
  } else {
    amountPaise = (credits as number) * cfg.pricePaisePerCredit;
    creditGrant = credits as number;
  }

  const addon = plan_code ? premiumDays <= 0 && creditGrant > 0 : true;
  if (addon && !(await memberAccess(uid)).addonsAllowed) {
    return c.json({ error: "Buy a membership before adding contact credits." }, 402);
  }

  if (!Number.isFinite(amountPaise) || amountPaise < 100) {
    return c.json(
      { error: `This plan has an invalid price (${amountPaise}). Please edit the plan in admin settings.` },
      400
    );
  }

  const res = await razorpayFetch("/v1/orders", {
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

  const payRes = await razorpayFetch(
    `/v1/payments/${encodeURIComponent(razorpay_payment_id)}`,
    {
      method: "GET",
      headers: { Authorization: basicAuthHeader(cfg.keyId, cfg.keySecret) },
      body: "",
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

  const ordRes = await razorpayFetch(
    `/v1/orders/${encodeURIComponent(razorpay_order_id)}`,
    {
      method: "GET",
      headers: { Authorization: basicAuthHeader(cfg.keyId, cfg.keySecret) },
      body: "",
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

const subscribeSchema = z.object({ plan_code: z.string().min(1).max(60) }).strict();

const verifySubSchema = z
  .object({
    razorpay_subscription_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
  })
  .strict();

async function loadMembershipPlan(code: string): Promise<
  | { plan: MembershipPlan }
  | { error: string; status: 400 | 404 | 500 | 503 }
> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("plans")
    .select(
      "code,name,description,plan_type,price_paise,credits,duration_days,is_active,billing_period,total_cycles,razorpay_plan_id,razorpay_plan_key"
    )
    .eq("code", code)
    .maybeSingle();
  if (error) {
    if (isMissingColumn(error.message)) {
      return {
        error: "Membership billing is not set up yet. Run migration 0014 on the database.",
        status: 503,
      };
    }
    return { error: error.message, status: 500 };
  }
  if (!data || data.is_active !== true) {
    return { error: "Plan not found or inactive", status: 404 };
  }
  if (data.plan_type !== "subscription") {
    return { error: "This plan is not a recurring membership", status: 400 };
  }
  return { plan: data as MembershipPlan };
}

async function ensureRazorpayPlan(
  cfg: { keyId: string; keySecret: string },
  plan: MembershipPlan
): Promise<{ id: string } | { error: string }> {
  const key = planKey(plan);
  if (plan.razorpay_plan_id && plan.razorpay_plan_key === key) {
    return { id: plan.razorpay_plan_id };
  }
  const cycle = billingCycle(plan.billing_period || "monthly");
  const res = await razorpayFetch("/v1/plans", {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(cfg.keyId, cfg.keySecret),
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "Mangalam-Backend/1.0",
    },
    body: JSON.stringify({
      period: cycle.period,
      interval: cycle.interval,
      item: {
        name: plan.name.slice(0, 80),
        amount: plan.price_paise,
        currency: "INR",
        description: (plan.description ?? plan.name).slice(0, 200),
      },
      notes: { plan_code: plan.code },
    }),
  });
  const read = await readRazorpay(res);
  if (!res.ok || !read.data?.id) {
    return {
      error: `Could not create the Razorpay membership plan: ${razorpayErrorDescription(read.data, read.text, read.status)}`,
    };
  }
  const id = String(read.data.id);
  const { error } = await getSupabaseAdmin()
    .from("plans")
    .update({ razorpay_plan_id: id, razorpay_plan_key: key, updated_at: new Date().toISOString() })
    .eq("code", plan.code);
  if (error) return { error: error.message };
  return { id };
}

paymentsRouter.get("/membership", async (c) => {
  const uid = c.get("userId");
  const sb = getSupabaseAdmin();
  const { data: wallet } = await sb
    .from("wallets")
    .select("premium_until,contact_credits")
    .eq("profile_id", uid)
    .maybeSingle();
  const { data, error } = await sb
    .from("member_subscriptions")
    .select(
      "plan_code,status,current_period_end,cancel_at_period_end,razorpay_subscription_id,created_at"
    )
    .eq("profile_id", uid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && !isMissingColumn(error.message)) {
    return c.json({ error: error.message }, 500);
  }

  const paySelect =
    "razorpay_payment_id,amount_paise,credits,premium_days,plan_code,created_at";
  let payRows: Record<string, unknown>[] = [];
  const pay = await sb
    .from("razorpay_payment_credits")
    .select(paySelect)
    .eq("profile_id", uid)
    .order("created_at", { ascending: false })
    .limit(30);
  if (pay.error && isMissingColumn(pay.error.message)) {
    const fallback = await sb
      .from("razorpay_payment_credits")
      .select("razorpay_payment_id,amount_paise,credits,created_at")
      .eq("profile_id", uid)
      .order("created_at", { ascending: false })
      .limit(30);
    payRows = (fallback.data ?? []) as Record<string, unknown>[];
  } else if (!pay.error) {
    payRows = (pay.data ?? []) as Record<string, unknown>[];
  }

  const codes = new Set<string>();
  if (data?.plan_code) codes.add(String(data.plan_code));
  for (const row of payRows) {
    const code = row.plan_code ? String(row.plan_code) : "";
    if (code) codes.add(code);
  }
  const planByCode = new Map<string, Record<string, unknown>>();
  if (codes.size > 0) {
    const { data: plans } = await sb
      .from("plans")
      .select("code,name,billing_period,duration_days,credits")
      .in("code", [...codes]);
    for (const plan of plans ?? []) {
      planByCode.set(String(plan.code), plan as Record<string, unknown>);
    }
  }
  const subPlan = data?.plan_code ? planByCode.get(String(data.plan_code)) : undefined;
  const access = await memberAccess(uid);
  const priceRes = await sb
    .from("app_settings")
    .select("message_credit_cost,message_free_per_chat")
    .eq("id", 1)
    .maybeSingle();
  const priceMissing =
    !!priceRes.error &&
    /message_credit_cost|message_free_per_chat|column/i.test(priceRes.error.message);
  const messageCreditCost = priceMissing
    ? null
    : Math.max(0, Math.min(1000, Math.floor(Number(priceRes.data?.message_credit_cost ?? 1))));
  const messageFreePerChat = priceMissing
    ? 0
    : Math.max(0, Math.min(1000, Math.floor(Number(priceRes.data?.message_free_per_chat ?? 0))));

  return c.json({
    premium_until: wallet?.premium_until ?? null,
    contact_credits: Number(wallet?.contact_credits ?? 0),
    membership_waived: access.waived,
    benefits_active: access.benefits,
    addons_allowed: access.addonsAllowed,
    message_credit_cost: messageCreditCost,
    message_free_per_chat: messageFreePerChat,
    subscription: data
      ? {
          ...data,
          plan_name: (subPlan?.name as string | undefined) ?? null,
          billing_period: (subPlan?.billing_period as string | undefined) ?? null,
          duration_days: (subPlan?.duration_days as number | undefined) ?? null,
          plan_credits: Number(subPlan?.credits ?? 0),
        }
      : null,
    payments: payRows.map((row) => {
      const code = row.plan_code ? String(row.plan_code) : "";
      const plan = code ? planByCode.get(code) : undefined;
      return {
        id: row.razorpay_payment_id,
        amount_paise: Number(row.amount_paise ?? 0),
        credits: Number(row.credits ?? 0),
        premium_days: Number(row.premium_days ?? plan?.duration_days ?? 0),
        plan_code: code || null,
        plan_name: (plan?.name as string | undefined) ?? null,
        billing_period: (plan?.billing_period as string | undefined) ?? null,
        created_at: row.created_at ?? null,
      };
    }),
  });
});

paymentsRouter.post("/razorpay/subscribe", async (c) => {
  const cfg = await razorpayConfigAsync();
  if ("error" in cfg) return c.json({ error: cfg.error }, 503);
  const uid = c.get("userId");
  const parsed = subscribeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const loaded = await loadMembershipPlan(parsed.data.plan_code);
  if ("error" in loaded) return c.json({ error: loaded.error }, loaded.status);
  const plan = loaded.plan;
  if (!Number.isFinite(plan.price_paise) || plan.price_paise < 100) {
    return c.json({ error: "This membership has an invalid price. Edit it in admin." }, 400);
  }

  const sb = getSupabaseAdmin();
  const { data: current, error: curErr } = await sb
    .from("member_subscriptions")
    .select("status,cancel_at_period_end")
    .eq("profile_id", uid)
    .in("status", ["active", "authenticated", "pending"])
    .limit(1)
    .maybeSingle();
  if (curErr && !isMissingColumn(curErr.message)) {
    return c.json({ error: curErr.message }, 500);
  }
  if (current && current.cancel_at_period_end !== true) {
    return c.json(
      { error: "You already have a membership. Cancel it before starting another." },
      409
    );
  }

  const rpPlan = await ensureRazorpayPlan(cfg, plan);
  if ("error" in rpPlan) return c.json({ error: rpPlan.error }, 502);

  const cycles = Math.min(60, Math.max(1, Number(plan.total_cycles) || 12));
  const days = accessDays(plan);
  const credits = Math.max(0, Number(plan.credits) || 0);
  const res = await razorpayFetch("/v1/subscriptions", {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(cfg.keyId, cfg.keySecret),
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "Mangalam-Backend/1.0",
    },
    body: JSON.stringify({
      plan_id: rpPlan.id,
      total_count: cycles,
      customer_notify: 1,
      notes: {
        profile_id: uid,
        plan_code: plan.code,
        premium_days: String(days),
        credits: String(credits),
      },
    }),
  });
  const read = await readRazorpay(res);
  if (!res.ok || !read.data?.id) {
    return c.json(
      {
        error: `Could not start the membership: ${razorpayErrorDescription(read.data, read.text, read.status)}`,
      },
      502
    );
  }
  const subscriptionId = String(read.data.id);
  try {
    await saveSubscription({
      profileId: uid,
      planCode: plan.code,
      subscriptionId,
      razorpayPlanId: rpPlan.id,
      status: String(read.data.status ?? "created"),
      periodEnd: null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!isMissingColumn(message)) return c.json({ error: message }, 500);
  }
  return c.json({
    key_id: cfg.keyId,
    subscription_id: subscriptionId,
    plan_code: plan.code,
    plan_name: plan.name,
  });
});

paymentsRouter.post("/razorpay/verify-subscription", async (c) => {
  const cfg = await razorpayConfigAsync();
  if ("error" in cfg) return c.json({ error: cfg.error }, 503);
  const uid = c.get("userId");
  const parsed = verifySubSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = parsed.data;

  const expected = await hmacSha256Hex(
    cfg.keySecret,
    `${razorpay_payment_id}|${razorpay_subscription_id}`
  );
  if (!safeEqual(expected, razorpay_signature)) {
    return c.json({ error: "Invalid payment signature" }, 400);
  }

  const applied = await fulfillSubscriptionPayment(cfg, {
    paymentId: razorpay_payment_id,
    subscriptionId: razorpay_subscription_id,
    expectedProfileId: uid,
  });
  if (!applied.ok) return c.json({ error: applied.error }, applied.status);
  const { data: wallet } = await getSupabaseAdmin()
    .from("wallets")
    .select("*")
    .eq("profile_id", uid)
    .maybeSingle();
  return c.json({ ok: true, already_applied: applied.already, wallet: wallet ?? null });
});

paymentsRouter.post("/razorpay/subscription/cancel", async (c) => {
  const cfg = await razorpayConfigAsync();
  if ("error" in cfg) return c.json({ error: cfg.error }, 503);
  const uid = c.get("userId");
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("member_subscriptions")
    .select("razorpay_subscription_id,status,current_period_end")
    .eq("profile_id", uid)
    .in("status", ["active", "authenticated", "pending", "created"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingColumn(error.message)) {
      return c.json({ error: "Membership billing is not set up yet." }, 503);
    }
    return c.json({ error: error.message }, 500);
  }
  if (!data?.razorpay_subscription_id) {
    return c.json({ error: "No active membership to cancel" }, 404);
  }
  const res = await razorpayFetch(
    `/v1/subscriptions/${encodeURIComponent(data.razorpay_subscription_id)}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(cfg.keyId, cfg.keySecret),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ cancel_at_cycle_end: 1 }),
    }
  );
  const read = await readRazorpay(res);
  if (!res.ok) {
    return c.json(
      {
        error: `Could not cancel the membership: ${razorpayErrorDescription(read.data, read.text, read.status)}`,
      },
      502
    );
  }
  await sb
    .from("member_subscriptions")
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq("razorpay_subscription_id", data.razorpay_subscription_id);
  return c.json({
    ok: true,
    current_period_end: data.current_period_end,
  });
});

paymentsRouter.post("/razorpay/webhook", async (c) => {
  const secret = await webhookSecret();
  if (!secret) return c.json({ error: "Webhook secret is not configured" }, 503);
  const raw = await c.req.text();
  const given = c.req.header("x-razorpay-signature") ?? "";
  const expected = await hmacSha256Hex(secret, raw);
  if (!safeEqual(expected, given)) return c.json({ error: "Invalid webhook signature" }, 400);
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return c.json({ error: "Invalid webhook body" }, 400);
  }
  const name = String(event.event ?? "");
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const subscription = entityOf(payload.subscription);
  const payment = entityOf(payload.payment);
  if (!subscription) return c.json({ ok: true, ignored: true });

  const subscriptionId = String(subscription.id ?? "");
  const notes = (subscription.notes ?? {}) as Record<string, string>;
  const profileId = notes.profile_id ?? "";
  const planCode = notes.plan_code ?? "";
  const status = String(subscription.status ?? "created");
  if (!subscriptionId || !profileId) return c.json({ ok: true, ignored: true });

  if (name === "subscription.charged" || name === "subscription.activated") {
    const paymentId = payment?.id ? String(payment.id) : "";
    const paymentStatus = String(payment?.status ?? "");
    if (paymentId && (paymentStatus === "captured" || paymentStatus === "authorized")) {
      const cfg = await razorpayConfigAsync();
      if ("error" in cfg) return c.json({ error: cfg.error }, 503);
      const applied = await fulfillSubscriptionPayment(cfg, {
        paymentId,
        subscriptionId,
        expectedProfileId: profileId,
      });
      if (!applied.ok) return c.json({ error: applied.error }, applied.status);
    }
  }

  const days = Number.parseInt(notes.premium_days ?? "", 10);
  await saveSubscription({
    profileId,
    planCode: planCode || "membership",
    subscriptionId,
    razorpayPlanId: subscription.plan_id ? String(subscription.plan_id) : null,
    status: name === "subscription.cancelled" ? "cancelled" : status,
    periodEnd: periodEndIso(subscription.current_end, Number.isFinite(days) ? days : 30),
    cancelAtPeriodEnd:
      name === "subscription.cancelled" ||
      subscription.cancel_at_cycle_end === true ||
      subscription.cancel_at_cycle_end === 1,
  });
  return c.json({ ok: true });
});

function entityOf(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const entity = (value as { entity?: unknown }).entity;
  if (!entity || typeof entity !== "object") return null;
  return entity as Record<string, unknown>;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function webhookSecret(): Promise<string | null> {
  try {
    const { data } = await getSupabaseAdmin()
      .from("app_settings")
      .select("razorpay_webhook_secret")
      .eq("id", 1)
      .maybeSingle();
    const fromDb = (data?.razorpay_webhook_secret as string | undefined)?.trim();
    if (fromDb) return fromDb;
  } catch {
    // fall through
  }
  return env("RAZORPAY_WEBHOOK_SECRET")?.trim() || null;
}

async function fulfillSubscriptionPayment(
  cfg: { keyId: string; keySecret: string },
  input: { paymentId: string; subscriptionId: string; expectedProfileId: string }
): Promise<
  | { ok: true; already: boolean }
  | { ok: false; error: string; status: 400 | 403 | 404 | 500 | 502 | 503 }
> {
  const headers = { Authorization: basicAuthHeader(cfg.keyId, cfg.keySecret) };
  const [subRes, payRes] = await Promise.all([
    razorpayFetch(`/v1/subscriptions/${encodeURIComponent(input.subscriptionId)}`, {
      method: "GET",
      headers,
      body: "",
    }),
    razorpayFetch(`/v1/payments/${encodeURIComponent(input.paymentId)}`, {
      method: "GET",
      headers,
      body: "",
    }),
  ]);
  const subRead = await readRazorpay(subRes);
  const payRead = await readRazorpay(payRes);
  if (!subRes.ok || !subRead.data) {
    return {
      ok: false,
      status: 502,
      error: `Could not load the membership: ${razorpayErrorDescription(subRead.data, subRead.text, subRead.status)}`,
    };
  }
  if (!payRes.ok || !payRead.data) {
    return {
      ok: false,
      status: 502,
      error: `Could not load the payment: ${razorpayErrorDescription(payRead.data, payRead.text, payRead.status)}`,
    };
  }
  const sub = subRead.data as Record<string, unknown>;
  const pay = payRead.data as Record<string, unknown>;
  const notes = (sub.notes ?? {}) as Record<string, string>;
  if (!notes.profile_id || notes.profile_id !== input.expectedProfileId) {
    return { ok: false, status: 403, error: "This membership does not belong to this member" };
  }
  const payStatus = String(pay.status ?? "");
  if (payStatus !== "captured" && payStatus !== "authorized") {
    return { ok: false, status: 400, error: `Payment not successful (${payStatus})` };
  }
  const paySub = String(pay.subscription_id ?? "");
  if (paySub && paySub !== input.subscriptionId) {
    return { ok: false, status: 400, error: "Payment does not match this membership" };
  }
  const planCode = notes.plan_code ?? "";
  const loaded = planCode ? await loadMembershipPlan(planCode) : null;
  const days = loaded && "plan" in loaded ? accessDays(loaded.plan) : Number.parseInt(notes.premium_days ?? "", 10);
  const credits = loaded && "plan" in loaded ? Number(loaded.plan.credits) || 0 : Number.parseInt(notes.credits ?? "", 10);
  const amount = typeof pay.amount === "number" ? pay.amount : 0;
  if (loaded && "plan" in loaded && amount > 0 && amount !== loaded.plan.price_paise) {
    return { ok: false, status: 400, error: "Payment amount does not match the membership" };
  }
  const applied = await applyCharge({
    paymentId: input.paymentId,
    profileId: input.expectedProfileId,
    credits: Number.isFinite(credits) ? credits : 0,
    premiumDays: Number.isFinite(days) ? days : 30,
    amountPaise: amount,
    planCode: planCode || null,
  });
  if (!applied.ok) return applied;
  await saveSubscription({
    profileId: input.expectedProfileId,
    planCode: planCode || "membership",
    subscriptionId: input.subscriptionId,
    razorpayPlanId: sub.plan_id ? String(sub.plan_id) : null,
    status: String(sub.status ?? "active"),
    periodEnd: periodEndIso(sub.current_end, Number.isFinite(days) ? days : 30),
    cancelAtPeriodEnd: sub.cancel_at_cycle_end === true || sub.cancel_at_cycle_end === 1,
  });
  return applied;
}
