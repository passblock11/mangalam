import { Hono } from "hono";
import { z } from "zod";
import {
  accessDays,
  assertCanPurchaseMembership,
  billingCycle,
  isMissingColumn,
  saveSubscription,
  type MembershipPlan,
} from "../billing.js";
import { memberAccess } from "../contact-access.js";
import {
  activePaymentProvider,
  cancelCashfreeSubscription,
  cashfreeConfig,
  cashfreeConfigs,
  cashfreeError,
  cashfreeFetch,
  fulfillCashfreeOrder,
  fulfillCashfreeOrderResolved,
  fulfillCashfreeSubscription,
  fulfillCashfreeSubscriptionResolved,
  payerFor,
  rupees,
  verifyCashfreeWebhook,
} from "../cashfree.js";
import { env } from "../env.js";
import { getSupabaseAdmin } from "../supabase.js";

const orderBody = z.object({
  credits: z.number().int().min(1).max(500).optional(),
  plan_code: z.string().min(1).max(60).optional(),
}).refine((value) => value.credits || value.plan_code, "Provide credits or plan_code");

const orderIdBody = z.object({ order_id: z.string().min(4).max(50) }).strict();
const subscriptionBody = z.object({ plan_code: z.string().min(1).max(60) }).strict();
const subscriptionIdBody = z.object({ subscription_id: z.string().min(4).max(250) }).strict();

function merchantId(prefix: string, profileId: string): string {
  return `${prefix}${profileId.replace(/-/g, "").slice(0, 10)}${Date.now()}`.slice(0, 45);
}

function intervalFor(period: string): { plan_interval_type: "DAY" | "WEEK" | "MONTH" | "YEAR"; plan_intervals: number } {
  const cycle = billingCycle(period);
  if (cycle.period === "yearly") return { plan_interval_type: "YEAR", plan_intervals: 1 };
  if (cycle.interval === 3) return { plan_interval_type: "MONTH", plan_intervals: 3 };
  return { plan_interval_type: "MONTH", plan_intervals: 1 };
}

export const cashfreeRouter = new Hono();

cashfreeRouter.get("/gateway", async (c) => {
  const provider = await activePaymentProvider();
  if (provider === "phonepe") {
    const { phonepeConfig, phonepeCheckoutScript } = await import("../phonepe.js");
    const cfg = await phonepeConfig();
    if ("error" in cfg) return c.json({ provider: "phonepe", ready: false, environment: "sandbox" });
    return c.json({
      provider: "phonepe",
      ready: true,
      environment: cfg.environment,
      merchant_id: cfg.merchantId,
      checkout_script: phonepeCheckoutScript(cfg.environment),
    });
  }
  if (provider !== "cashfree") return c.json({ provider: "razorpay" });
  const cfg = await cashfreeConfig();
  if ("error" in cfg) return c.json({ provider: "cashfree", ready: false, environment: "sandbox" });
  return c.json({ provider: "cashfree", ready: true, environment: cfg.environment });
});

cashfreeRouter.post("/order", async (c) => {
  const cfg = await cashfreeConfig();
  if ("error" in cfg) return c.json({ error: cfg.error }, 503);
  const uid = c.get("userId");
  const parsed = orderBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  let amountPaise = 0;
  let credits = 0;
  let premiumDays = 0;
  let planCode = "";
  if (parsed.data.plan_code) {
    const { data, error } = await getSupabaseAdmin()
      .from("plans")
      .select("code,name,price_paise,credits,duration_days,plan_type,is_active")
      .eq("code", parsed.data.plan_code)
      .maybeSingle();
    if (error) return c.json({ error: error.message }, 500);
    if (!data || data.is_active !== true) return c.json({ error: "Plan not found or inactive" }, 404);
    if (data.plan_type === "subscription") {
      return c.json({ error: "This is a membership. It renews automatically and must be started from Membership." }, 400);
    }
    amountPaise = Number(data.price_paise);
    credits = Number(data.credits ?? 0);
    premiumDays = data.plan_type === "one_time" ? Number(data.duration_days ?? 0) : 0;
    planCode = String(data.code);
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
  const payer = await payerFor(uid);
  if ("error" in payer) return c.json({ error: payer.error }, 400);

  const orderId = merchantId("mg", uid);
  const created = await cashfreeFetch(cfg, "/orders", {
    method: "POST",
    idempotencyKey: orderId,
    body: {
      order_id: orderId,
      order_amount: rupees(amountPaise),
      order_currency: "INR",
      customer_details: {
        customer_id: payer.id,
        customer_name: payer.name,
        customer_email: payer.email,
        customer_phone: payer.phone,
      },
      order_meta: {
        return_url: "https://mangalam-web-beta.vercel.app/membership?order_id={order_id}",
        notify_url: "https://mangalam-api.vercel.app/v1/payments/cashfree/webhook",
      },
      order_note: planCode || "Mangalam credits",
      order_tags: {
        profile_id: uid,
        plan_code: planCode,
        credits: String(credits),
        premium_days: String(premiumDays),
        amount_paise: String(amountPaise),
      },
    },
  });
  const data = created.data && typeof created.data === "object" ? created.data as Record<string, unknown> : null;
  if (!created.ok || !data?.payment_session_id) {
    return c.json({ error: `Cashfree order failed: ${cashfreeError(created.data, created.text, created.status)}` }, 502);
  }
  return c.json({
    provider: "cashfree",
    environment: cfg.environment,
    order_id: String(data.order_id ?? orderId),
    payment_session_id: String(data.payment_session_id),
    amount_paise: amountPaise,
  });
});

cashfreeRouter.post("/verify", async (c) => {
  const parsed = orderIdBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const applied = await fulfillCashfreeOrderResolved(parsed.data.order_id, c.get("userId"));
  if (!applied.ok) return c.json({ error: applied.error }, applied.status);
  const { data: wallet } = await getSupabaseAdmin().from("wallets").select("*").eq("profile_id", c.get("userId")).maybeSingle();
  return c.json({ ok: true, already_applied: applied.already, wallet: wallet ?? null });
});

cashfreeRouter.post("/subscribe", async (c) => {
  const cfg = await cashfreeConfig();
  if ("error" in cfg) return c.json({ error: cfg.error }, 503);
  const uid = c.get("userId");
  const parsed = subscriptionBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { data, error } = await getSupabaseAdmin()
    .from("plans")
    .select("code,name,description,plan_type,price_paise,credits,duration_days,is_active,billing_period,total_cycles,razorpay_plan_id,razorpay_plan_key")
    .eq("code", parsed.data.plan_code)
    .maybeSingle();
  if (error) {
    if (isMissingColumn(error.message)) return c.json({ error: "Membership billing is not set up yet." }, 503);
    return c.json({ error: error.message }, 500);
  }
  const plan = data as MembershipPlan | null;
  if (!plan || plan.is_active !== true || plan.plan_type !== "subscription") {
    return c.json({ error: "This plan is not a recurring membership" }, 400);
  }
  if (!Number.isFinite(plan.price_paise) || plan.price_paise < 100) {
    return c.json({ error: "This membership has an invalid price. Edit it in admin." }, 400);
  }
  const sb = getSupabaseAdmin();
  const current = await sb
    .from("member_subscriptions")
    .select("id,status,cancel_at_period_end,razorpay_subscription_id")
    .eq("profile_id", uid)
    .in("status", ["active", "authenticated", "pending"])
    .order("updated_at", { ascending: false })
    .limit(5);
  if (current.error && !isMissingColumn(current.error.message)) return c.json({ error: current.error.message }, 500);
  const purchase = await assertCanPurchaseMembership(uid);
  if (!purchase.ok) return c.json({ error: purchase.error }, purchase.status);
  const open = (current.data ?? []).filter((row) => row.cancel_at_period_end !== true);
  // Abandoned checkouts leave status=pending and used to block every retry with 409.
  for (const row of open.filter((item) => item.status === "pending")) {
    const priorId = String(row.razorpay_subscription_id ?? "");
    if (priorId.startsWith("cfsub")) {
      await cancelCashfreeSubscription(priorId).catch(() => null);
    }
    await sb
      .from("member_subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", row.id);
  }
  const payer = await payerFor(uid);
  if ("error" in payer) return c.json({ error: payer.error }, 400);
  const days = accessDays(plan);
  const credits = Math.max(0, Number(plan.credits) || 0);
  const cycles = Math.min(100, Math.max(1, Number(plan.total_cycles) || 12));
  const interval = intervalFor(plan.billing_period || "monthly");
  const subscriptionId = merchantId("cfsub", uid);
  const amount = rupees(plan.price_paise);
  const created = await cashfreeFetch(cfg, "/subscriptions", {
    method: "POST",
    idempotencyKey: subscriptionId,
    body: {
      subscription_id: subscriptionId,
      customer_details: {
        customer_name: payer.name,
        customer_email: payer.email,
        customer_phone: payer.phone.replace("+91", ""),
      },
      plan_details: {
        plan_name: plan.name.slice(0, 40),
        plan_type: "PERIODIC",
        plan_currency: "INR",
        plan_amount: amount,
        plan_max_amount: amount,
        plan_max_cycles: cycles,
        plan_intervals: interval.plan_intervals,
        plan_interval_type: interval.plan_interval_type,
        plan_note: (plan.description ?? plan.name).slice(0, 200),
      },
      authorization_details: {
        authorization_amount: amount,
        authorization_amount_refund: false,
      },
      subscription_meta: {
        return_url: "https://mangalam-web-beta.vercel.app/membership",
        notification_channel: ["EMAIL"],
      },
      subscription_tags: {
        profile_id: uid,
        plan_code: plan.code,
        credits: String(credits),
        premium_days: String(days),
        amount_paise: String(plan.price_paise),
      },
    },
  });
  const body = created.data && typeof created.data === "object" ? created.data as Record<string, unknown> : null;
  if (!created.ok || !body?.subscription_session_id) {
    return c.json({ error: `Could not start the membership: ${cashfreeError(created.data, created.text, created.status)}` }, 502);
  }
  try {
    await saveSubscription({
      profileId: uid,
      planCode: plan.code,
      subscriptionId,
      razorpayPlanId: null,
      status: "pending",
      periodEnd: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isMissingColumn(message)) return c.json({ error: message }, 500);
  }
  return c.json({
    provider: "cashfree",
    environment: cfg.environment,
    subscription_id: subscriptionId,
    subscription_session_id: String(body.subscription_session_id),
    plan_code: plan.code,
    plan_name: plan.name,
  });
});

cashfreeRouter.post("/verify-subscription", async (c) => {
  const parsed = subscriptionIdBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const applied = await fulfillCashfreeSubscriptionResolved(parsed.data.subscription_id, c.get("userId"));
  if (!applied.ok) return c.json({ error: applied.error }, applied.status);
  const { data: wallet } = await getSupabaseAdmin().from("wallets").select("*").eq("profile_id", c.get("userId")).maybeSingle();
  return c.json({ ok: true, already_applied: applied.already, wallet: wallet ?? null });
});

function subscriptionIdFromWebhook(data: Record<string, unknown>): string {
  const direct = String(data.subscription_id ?? "").trim();
  if (direct) return direct;
  const nested = (data.subscription ?? data.subscription_details ?? null) as Record<string, unknown> | null;
  const fromNested = String(nested?.subscription_id ?? "").trim();
  return fromNested;
}

function shouldFulfillSubscriptionWebhook(type: string, data: Record<string, unknown>): boolean {
  if (type === "SUBSCRIPTION_PAYMENT_SUCCESS") return true;
  if (type === "SUBSCRIPTION_STATUS_CHANGED") {
    const details = (data.subscription_details ?? data) as Record<string, unknown>;
    return String(details.subscription_status ?? "").toUpperCase() === "ACTIVE";
  }
  if (type === "SUBSCRIPTION_AUTH_STATUS") {
    const auth = (data.authorization_details ?? {}) as Record<string, unknown>;
    const authStatus = String(auth.authorization_status ?? "").toUpperCase();
    const details = (data.subscription_details ?? data) as Record<string, unknown>;
    const subStatus = String(details.subscription_status ?? data.subscription_status ?? "").toUpperCase();
    return authStatus === "ACTIVE" || authStatus === "SUCCESS" || subStatus === "ACTIVE";
  }
  return type.includes("SUBSCRIPTION") && type.includes("SUCCESS");
}

cashfreeRouter.post("/webhook", async (c) => {
  const configs = await cashfreeConfigs();
  if (configs.length === 0) {
    const cfg = await cashfreeConfig();
    return c.json({ error: "error" in cfg ? cfg.error : "Cashfree is not configured." }, 503);
  }
  const raw = await c.req.text();
  const signature = c.req.header("x-webhook-signature") ?? "";
  const timestamp = c.req.header("x-webhook-timestamp") ?? "";
  let cfg = configs[0];
  let valid = false;
  for (const candidate of configs) {
    if (await verifyCashfreeWebhook(candidate, raw, signature, timestamp)) {
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
  const type = String(event.type ?? "");
  const data = (event.data ?? {}) as Record<string, unknown>;
  if (type === "PAYMENT_SUCCESS_WEBHOOK") {
    const order = (data.order ?? {}) as { order_id?: string };
    if (order.order_id) await fulfillCashfreeOrder(cfg, order.order_id);
    return c.json({ ok: true });
  }
  if (shouldFulfillSubscriptionWebhook(type, data)) {
    const subscriptionId = subscriptionIdFromWebhook(data);
    if (subscriptionId) await fulfillCashfreeSubscription(cfg, subscriptionId);
  }
  return c.json({ ok: true });
});

export { cancelCashfreeSubscription };
