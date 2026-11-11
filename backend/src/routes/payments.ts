import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { env } from "../env.js";
import { getSupabaseAdmin } from "../supabase.js";

const orderBodySchema = z
  .object({
    credits: z.number().int().min(1).max(500),
  })
  .strict();

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
  const { credits } = parsed.data;
  const amountPaise = credits * cfg.pricePaisePerCredit;

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(cfg.keyId, cfg.keySecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: `credits_${uid.slice(0, 8)}_${Date.now()}`,
      notes: {
        profile_id: uid,
        credits: String(credits),
        price_paise_per_credit: String(cfg.pricePaisePerCredit),
      },
    }),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return c.json(
      { error: (data.error as { description?: string } | undefined)?.description ?? "Razorpay order failed" },
      502
    );
  }

  const order = data as RazorpayOrder;
  return c.json({
    key_id: cfg.keyId,
    order_id: order.id,
    amount_paise: order.amount,
    currency: order.currency,
    credits,
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
  const payment = (await payRes.json()) as RazorpayPayment & Record<string, unknown>;
  if (!payRes.ok) {
    return c.json({ error: "Could not load payment from Razorpay" }, 502);
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
  const order = (await ordRes.json()) as RazorpayOrder & { notes?: Record<string, string> };
  if (!ordRes.ok) {
    return c.json({ error: "Could not load order from Razorpay" }, 502);
  }
  const notesProfile = order.notes?.profile_id;
  const notesCredits = order.notes?.credits;
  if (!notesProfile || notesProfile !== uid) {
    return c.json({ error: "Order does not belong to this user" }, 403);
  }
  const credits = Number.parseInt(notesCredits ?? "", 10);
  if (!Number.isFinite(credits) || credits < 1) {
    return c.json({ error: "Invalid order metadata" }, 400);
  }

  const expectedAmount = credits * cfg.pricePaisePerCredit;
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
  });
  if (insErr) {
    return c.json({ error: insErr.message }, 500);
  }

  const { data: walletRow, error: wErr } = await sb
    .from("wallets")
    .select("contact_credits")
    .eq("profile_id", uid)
    .maybeSingle();
  if (wErr) return c.json({ error: wErr.message }, 500);

  const prev = (walletRow?.contact_credits as number | null) ?? 0;
  const { data: wallet, error: upErr } = await sb
    .from("wallets")
    .update({
      contact_credits: prev + credits,
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
    wallet: wallet ?? null,
  });
});
