import { Hono } from "hono";
import { z } from "zod";
import {
  accessDays,
  isMissingColumn,
  type MembershipPlan,
} from "../billing.js";
import { memberAccess } from "../contact-access.js";
import { env } from "../env.js";
import {
  createPhonePeSdkOrder,
  createPhonePeWebPay,
  fulfillPhonePeCheckoutResolved,
  fulfillPhonePeRedemption,
  fulfillPhonePeSubscriptionById,
  fulfillPhonePeSubscriptionSetupResolved,
  phonepeCheckoutScript,
  phonepeConfig,
  phonepeConfigs,
  phonepeMerchantOrderId,
  phonepeMerchantSubscriptionIdFromStored,
  phonepeRedirectBase,
  verifyPhonePeWebhook,
} from "../phonepe.js";
import { phonepeSubscribeHandler } from "./phonepe_subscribe.js";
import { getSupabaseAdmin } from "../supabase.js";

const orderBody = z
  .object({
    credits: z.number().int().min(1).max(500).optional(),
    plan_code: z.string().min(1).max(60).optional(),
    channel: z.enum(["app", "web"]).optional(),
  })
  .refine((value) => value.credits || value.plan_code, "Provide credits or plan_code");

const verifyBody = z.object({ merchant_order_id: z.string().min(4).max(63) }).strict();
const verifySubscriptionBody = z
  .object({
    merchant_order_id: z.string().min(4).max(63).optional(),
    merchant_subscription_id: z.string().min(4).max(63).optional(),
  })
  .refine((v) => v.merchant_order_id || v.merchant_subscription_id, "merchant_order_id or merchant_subscription_id required")
  .strict();

export const phonepeRouter = new Hono();

phonepeRouter.get("/gateway", async (c) => {
  const { activePaymentProvider } = await import("../cashfree.js");
  const provider = await activePaymentProvider();
  if (provider !== "phonepe") return c.json({ provider });
  const cfg = await phonepeConfig();
  if ("error" in cfg) {
    return c.json({ provider: "phonepe", ready: false, environment: "sandbox" });
  }
  return c.json({
    provider: "phonepe",
    ready: true,
    environment: cfg.environment,
    merchant_id: cfg.merchantId,
    checkout_script: phonepeCheckoutScript(cfg.environment),
  });
});

phonepeRouter.post("/subscribe", async (c) => {
  const cfg = await phonepeConfig();
  if ("error" in cfg) return c.json({ error: cfg.error }, 503);
  return phonepeSubscribeHandler(c, cfg);
});

phonepeRouter.post("/order", async (c) => {
  const cfg = await phonepeConfig();
  if ("error" in cfg) return c.json({ error: cfg.error }, 503);
  const uid = c.get("userId");
  const parsed = orderBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  let amountPaise = 0;
  let credits = 0;
  let premiumDays = 0;
  let planCode = "";
  let planName = "Mangalam plan";

  if (parsed.data.plan_code) {
    const { data, error } = await getSupabaseAdmin()
      .from("plans")
      .select(
        "code,name,price_paise,credits,duration_days,plan_type,is_active,billing_period,total_cycles"
      )
      .eq("code", parsed.data.plan_code)
      .maybeSingle();
    if (error) {
      if (isMissingColumn(error.message)) return c.json({ error: "Billing is not set up yet." }, 503);
      return c.json({ error: error.message }, 500);
    }
    if (!data || data.is_active !== true) return c.json({ error: "Plan not found or inactive" }, 404);
    const plan = data as MembershipPlan;
    if (plan.plan_type === "subscription") {
      return c.json({ error: "Use POST /v1/payments/phonepe/subscribe for recurring membership." }, 400);
    }
    amountPaise = Number(plan.price_paise);
    credits = Math.max(0, Number(plan.credits) || 0);
    planCode = String(plan.code);
    planName = String(plan.name || plan.code);
    if (plan.plan_type === "subscription" || plan.plan_type === "one_time") {
      premiumDays = accessDays(plan);
    }
  } else {
    const raw = Number.parseInt(env("CONTACT_CREDIT_PRICE_PAISE") ?? "", 10);
    const price = Number.isFinite(raw) && raw > 0 ? raw : 100;
    credits = parsed.data.credits ?? 0;
    amountPaise = credits * price;
  }

  const addon = planCode ? premiumDays <= 0 && credits > 0 : true;
  if (addon && !(await memberAccess(uid)).addonsAllowed) {
    return c.json({ error: "Buy a membership before adding contact credits." }, 402);
  }
  if (!Number.isFinite(amountPaise) || amountPaise < 100) {
    return c.json({ error: "This plan has an invalid price. Edit it in admin settings." }, 400);
  }

  const merchantOrderId = phonepeMerchantOrderId(uid);
  const meta = {
    profileId: uid,
    planCode,
    credits,
    premiumDays,
    amountPaise,
  };
  const channel = parsed.data.channel ?? "app";

  if (channel === "web") {
    const created = await createPhonePeWebPay(cfg, {
      merchantOrderId,
      amountPaise,
      meta,
      redirectUrl: `${phonepeRedirectBase()}?merchant_order_id=${encodeURIComponent(merchantOrderId)}`,
    });
    if (!created.ok) return c.json({ error: created.error }, created.status);
    return c.json({
      provider: "phonepe",
      environment: cfg.environment,
      merchant_id: cfg.merchantId,
      merchant_order_id: created.merchantOrderId,
      order_id: created.orderId,
      redirect_url: created.redirectUrl,
      checkout_script: phonepeCheckoutScript(cfg.environment),
      amount_paise: amountPaise,
      plan_code: planCode || null,
      plan_name: planName,
    });
  }

  const created = await createPhonePeSdkOrder(cfg, {
    merchantOrderId,
    amountPaise,
    meta,
  });
  if (!created.ok) return c.json({ error: created.error }, created.status);
  return c.json({
    provider: "phonepe",
    environment: cfg.environment,
    merchant_id: cfg.merchantId,
    merchant_order_id: created.merchantOrderId,
    order_id: created.orderId,
    token: created.token,
    amount_paise: amountPaise,
    plan_code: planCode || null,
    plan_name: planName,
  });
});

phonepeRouter.post("/verify", async (c) => {
  const parsed = verifyBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const applied = await fulfillPhonePeCheckoutResolved(parsed.data.merchant_order_id, c.get("userId"));
  if (!applied.ok) return c.json({ error: applied.error }, applied.status);
  const { data: wallet } = await getSupabaseAdmin()
    .from("wallets")
    .select("*")
    .eq("profile_id", c.get("userId"))
    .maybeSingle();
  return c.json({ ok: true, already_applied: applied.already, wallet: wallet ?? null });
});

phonepeRouter.post("/confirm-pending", async (c) => {
  const uid = c.get("userId");
  const sb = getSupabaseAdmin();
  const access = await memberAccess(uid);
  if (access.active) {
    const { data: wallet } = await sb.from("wallets").select("*").eq("profile_id", uid).maybeSingle();
    return c.json({ ok: true, already: true, wallet: wallet ?? null });
  }
  const { data: row } = await sb
    .from("member_subscriptions")
    .select("razorpay_subscription_id,plan_code")
    .eq("profile_id", uid)
    .eq("status", "pending")
    .like("razorpay_subscription_id", "ppsub_%")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row?.razorpay_subscription_id) {
    return c.json({ error: "No pending PhonePe membership to confirm." }, 404);
  }
  const cfg = await phonepeConfig();
  if ("error" in cfg) return c.json({ error: cfg.error }, 503);
  const merchantSubscriptionId = phonepeMerchantSubscriptionIdFromStored(
    String(row.razorpay_subscription_id)
  );
  const applied = await fulfillPhonePeSubscriptionById(cfg, merchantSubscriptionId, uid);
  if (!applied.ok) return c.json({ error: applied.error }, applied.status);
  const { data: wallet } = await sb.from("wallets").select("*").eq("profile_id", uid).maybeSingle();
  return c.json({ ok: true, already_applied: applied.already, wallet: wallet ?? null });
});

phonepeRouter.post("/verify-subscription", async (c) => {
  const parsed = verifySubscriptionBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const uid = c.get("userId");
  const merchantSubscriptionId = String(parsed.data.merchant_subscription_id ?? "").trim();
  let applied;
  if (parsed.data.merchant_order_id) {
    applied = await fulfillPhonePeSubscriptionSetupResolved(
      parsed.data.merchant_order_id,
      uid,
      merchantSubscriptionId || undefined
    );
    if (
      !applied.ok &&
      merchantSubscriptionId &&
      (applied.error === "This is not a PhonePe subscription setup order." ||
        applied.error === "This payment is missing PhonePe subscription details." ||
        applied.error === "This payment is missing Mangalam payment details." ||
        applied.error === "Subscription setup is not confirmed yet.")
    ) {
      const cfg = await phonepeConfig();
      if (!("error" in cfg)) {
        const fallback = await fulfillPhonePeSubscriptionById(cfg, merchantSubscriptionId, uid);
        if (fallback.ok) applied = fallback;
      }
    }
  } else {
    const cfg = await phonepeConfig();
    if ("error" in cfg) return c.json({ error: cfg.error }, 503);
    applied = await fulfillPhonePeSubscriptionById(cfg, merchantSubscriptionId, uid);
  }
  if (!applied.ok) return c.json({ error: applied.error }, applied.status);
  const { data: wallet } = await getSupabaseAdmin().from("wallets").select("*").eq("profile_id", uid).maybeSingle();
  return c.json({ ok: true, already_applied: applied.already, wallet: wallet ?? null });
});

phonepeRouter.post("/webhook", async (c) => {
  const configs = await phonepeConfigs();
  if (configs.length === 0) {
    const cfg = await phonepeConfig();
    return c.json({ error: "error" in cfg ? cfg.error : "PhonePe is not configured." }, 503);
  }
  const raw = await c.req.text();
  const authorization = c.req.header("authorization") ?? "";
  const checksumKeyId =
    c.req.header("x-phonepe-checksum-key-id") ?? c.req.header("X-PHONEPE-CHECKSUM-KEY-ID") ?? "";
  const checksumSignature =
    c.req.header("phonepe-checksum-signature") ??
    c.req.header("x-phonepe-checksum-signature") ??
    c.req.header("PHONEPE-CHECKSUM-SIGNATURE") ??
    "";
  let cfg = configs[0];
  let valid = false;
  for (const candidate of configs) {
    if (
      await verifyPhonePeWebhook(candidate, {
        authorizationHeader: authorization,
        rawBody: raw,
        checksumKeyId,
        checksumSignature,
      })
    ) {
      cfg = candidate;
      valid = true;
      break;
    }
  }
  if (!valid) return c.json({ error: "Invalid webhook signature" }, 400);

  let event: Record<string, unknown> = {};
  try {
    event = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return c.json({ error: "Invalid webhook body" }, 400);
  }
  const type = String(event.event ?? "");
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  if (type === "checkout.order.completed") {
    const merchantOrderId = String(payload.merchantOrderId ?? "").trim();
    if (merchantOrderId) {
      const flow = (payload.paymentFlow ?? {}) as Record<string, unknown>;
      const flowType = String(flow.type ?? "").toUpperCase();
      if (flowType === "SUBSCRIPTION_CHECKOUT_SETUP") {
        await fulfillPhonePeSubscriptionSetupResolved(merchantOrderId);
      } else {
        await fulfillPhonePeCheckoutResolved(merchantOrderId);
      }
    }
  } else if (
    type === "subscription.redemption.order.completed" ||
    type === "subscription.redemption.transaction.completed"
  ) {
    await fulfillPhonePeRedemption(cfg, payload);
  } else if (type === "subscription.cancelled" || type === "subscription.revoked") {
    const merchantSubscriptionId = String(payload.merchantSubscriptionId ?? "").trim();
    if (merchantSubscriptionId) {
      const stored = `ppsub_${merchantSubscriptionId}`;
      await getSupabaseAdmin()
        .from("member_subscriptions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("razorpay_subscription_id", stored);
    }
  }
  return c.json({ ok: true });
});
