import type { Context } from "hono";
import { z } from "zod";
import {
  accessDays,
  assertCanPurchaseMembership,
  isMissingColumn,
  saveSubscription,
  type MembershipPlan,
} from "../billing.js";
import {
  createPhonePeSdkSubscription,
  createPhonePeWebSubscription,
  fulfillPhonePeSubscriptionById,
  phonepeCheckoutScript,
  phonepeMerchantOrderId,
  phonepeMerchantSubscriptionId,
  phonepeMerchantSubscriptionIdFromStored,
  phonepeRedirectBase,
  phonepeSubscriptionStatus,
  phonepeSubscriptionStoredId,
} from "../phonepe.js";
import type { PhonePeKeys } from "../integrations.js";
import { memberAccess } from "../contact-access.js";
import { getSupabaseAdmin } from "../supabase.js";

const PENDING_CONFIRM_MESSAGE =
  "We are still confirming your payment. Please wait and tap Continue — do not pay again.";

const subscribeBody = z
  .object({
    plan_code: z.string().min(1).max(60),
    channel: z.enum(["app", "web"]).optional(),
  })
  .strict();

export async function phonepeSubscribeHandler(
  c: Context,
  cfg: PhonePeKeys
): Promise<Response> {
  const uid = c.get("userId");
  const parsed = subscribeBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

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
  if (plan.plan_type !== "subscription") {
    return c.json({ error: "This plan is not a recurring membership" }, 400);
  }
  const amountPaise = Number(plan.price_paise);
  if (!Number.isFinite(amountPaise) || amountPaise < 100) {
    return c.json({ error: "This membership has an invalid price. Edit it in admin." }, 400);
  }

  const sb = getSupabaseAdmin();
  const current = await sb
    .from("member_subscriptions")
    .select("id,status,cancel_at_period_end,razorpay_subscription_id")
    .eq("profile_id", uid)
    .in("status", ["active", "authenticated", "pending", "created"])
    .order("updated_at", { ascending: false })
    .limit(5);
  if (current.error && !isMissingColumn(current.error.message)) {
    return c.json({ error: current.error.message }, 500);
  }
  const purchase = await assertCanPurchaseMembership(uid);
  if (!purchase.ok) return c.json({ error: purchase.error }, purchase.status);
  const access = await memberAccess(uid);
  if (access.active) {
    const { data: wallet } = await sb.from("wallets").select("*").eq("profile_id", uid).maybeSingle();
    return c.json({ membership_ready: true, wallet: wallet ?? null });
  }
  const open = (current.data ?? []).filter((row) => row.cancel_at_period_end !== true);
  const pendingRows = open.filter((item) => item.status === "pending");
  for (const row of pendingRows) {
    const priorId = String(row.razorpay_subscription_id ?? "");
    if (!priorId.startsWith("ppsub_")) {
      await sb
        .from("member_subscriptions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      continue;
    }
    const merchantSubscriptionId = phonepeMerchantSubscriptionIdFromStored(priorId);
    if (!merchantSubscriptionId) {
      await sb
        .from("member_subscriptions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      continue;
    }
    const applied = await fulfillPhonePeSubscriptionById(cfg, merchantSubscriptionId, uid);
    if (applied.ok) {
      const { data: wallet } = await sb.from("wallets").select("*").eq("profile_id", uid).maybeSingle();
      return c.json({ membership_ready: true, wallet: wallet ?? null });
    }
    const sub = await phonepeSubscriptionStatus(cfg, merchantSubscriptionId);
    if (sub.ok) {
      const state = String(sub.data.state ?? "").toUpperCase();
      if (state === "ACTIVE" || state === "ACTIVATION_IN_PROGRESS") {
        return c.json({ error: PENDING_CONFIRM_MESSAGE }, 409);
      }
    }
    // Abandoned checkout only — do not call PhonePe cancel (would kill a mandate user already paid for).
    await sb
      .from("member_subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  const credits = Math.max(0, Number(plan.credits) || 0);
  const premiumDays = accessDays(plan);
  const merchantOrderId = phonepeMerchantOrderId(uid);
  const merchantSubscriptionId = phonepeMerchantSubscriptionId(uid);
  const meta = {
    profileId: uid,
    planCode: plan.code,
    credits,
    premiumDays,
    amountPaise,
  };
  const channel = parsed.data.channel ?? "app";

  try {
    await saveSubscription({
      profileId: uid,
      planCode: plan.code,
      subscriptionId: phonepeSubscriptionStoredId(merchantSubscriptionId),
      razorpayPlanId: null,
      status: "pending",
      periodEnd: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isMissingColumn(message)) return c.json({ error: message }, 500);
  }

  if (channel === "web") {
    const created = await createPhonePeWebSubscription(cfg, {
      merchantOrderId,
      merchantSubscriptionId,
      amountPaise,
      billingPeriod: plan.billing_period,
      meta,
      redirectUrl: `${phonepeRedirectBase()}?merchant_order_id=${encodeURIComponent(merchantOrderId)}&merchant_subscription_id=${encodeURIComponent(merchantSubscriptionId)}`,
    });
    if (!created.ok) return c.json({ error: created.error }, created.status);
    return c.json({
      provider: "phonepe",
      flow: "subscription",
      environment: cfg.environment,
      merchant_id: cfg.merchantId,
      merchant_order_id: created.merchantOrderId,
      merchant_subscription_id: created.merchantSubscriptionId,
      order_id: created.orderId,
      redirect_url: created.redirectUrl,
      checkout_script: phonepeCheckoutScript(cfg.environment),
      amount_paise: amountPaise,
      plan_code: plan.code,
      plan_name: plan.name,
    });
  }

  const created = await createPhonePeSdkSubscription(cfg, {
    merchantOrderId,
    merchantSubscriptionId,
    amountPaise,
    billingPeriod: plan.billing_period,
    meta,
  });
  if (!created.ok) return c.json({ error: created.error }, created.status);
  return c.json({
    provider: "phonepe",
    flow: "subscription",
    environment: cfg.environment,
    merchant_id: cfg.merchantId,
    merchant_order_id: created.merchantOrderId,
    merchant_subscription_id: created.merchantSubscriptionId,
    order_id: created.orderId,
    token: created.token,
    amount_paise: amountPaise,
    plan_code: plan.code,
    plan_name: plan.name,
  });
}