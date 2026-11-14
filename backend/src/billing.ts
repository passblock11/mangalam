import { getSupabaseAdmin } from "./supabase.js";

export type MembershipPlan = {
  code: string;
  name: string;
  description: string | null;
  plan_type: string;
  price_paise: number;
  credits: number;
  duration_days: number | null;
  is_active: boolean;
  billing_period: string;
  total_cycles: number;
  razorpay_plan_id: string | null;
  razorpay_plan_key: string | null;
};

export function billingCycle(period: string): {
  period: "monthly" | "yearly";
  interval: number;
  days: number;
} {
  if (period === "yearly") return { period: "yearly", interval: 1, days: 365 };
  if (period === "quarterly") return { period: "monthly", interval: 3, days: 90 };
  return { period: "monthly", interval: 1, days: 30 };
}

export function accessDays(plan: { billing_period?: string | null; duration_days?: number | null }): number {
  const explicit = Number(plan.duration_days ?? 0);
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(explicit, 3660);
  return billingCycle(plan.billing_period ?? "monthly").days;
}

export function planKey(plan: {
  price_paise: number;
  billing_period?: string | null;
  name?: string | null;
}): string {
  const cycle = billingCycle(plan.billing_period ?? "monthly");
  return `${plan.price_paise}:${cycle.period}:${cycle.interval}:${(plan.name ?? "").slice(0, 40)}`;
}

export function isMissingColumn(message: string): boolean {
  return /column|schema cache|does not exist|member_subscriptions/i.test(message);
}

/** Record a captured payment once, then extend premium and credits. */
export async function applyCharge(input: {
  paymentId: string;
  profileId: string;
  credits: number;
  premiumDays: number;
  amountPaise: number;
  planCode: string | null;
}): Promise<
  | { ok: true; already: boolean }
  | { ok: false; error: string; status: 400 | 403 | 404 | 500 | 502 | 503 }
> {
  const sb = getSupabaseAdmin();
  const credits = Number.isFinite(input.credits) && input.credits > 0 ? Math.floor(input.credits) : 0;
  const days =
    Number.isFinite(input.premiumDays) && input.premiumDays > 0
      ? Math.floor(input.premiumDays)
      : 0;

  const { error: insErr } = await sb.from("razorpay_payment_credits").insert({
    razorpay_payment_id: input.paymentId,
    profile_id: input.profileId,
    credits,
    amount_paise: input.amountPaise,
    premium_days: days,
    plan_code: input.planCode,
  });
  if (insErr) {
    const code = (insErr as { code?: string }).code;
    if (code === "23505") return { ok: true, already: true };
    return { ok: false, error: insErr.message, status: 500 };
  }

  const { data: walletRow, error: wErr } = await sb
    .from("wallets")
    .select("contact_credits,premium_until")
    .eq("profile_id", input.profileId)
    .maybeSingle();
  if (wErr) {
    await sb.from("razorpay_payment_credits").delete().eq("razorpay_payment_id", input.paymentId);
    return { ok: false, error: wErr.message, status: 500 };
  }

  const prev = Number(walletRow?.contact_credits ?? 0);
  const prevUntil = (walletRow as { premium_until?: string | null } | null)?.premium_until ?? null;
  let nextUntil = prevUntil;
  if (days > 0) {
    const base =
      prevUntil && new Date(prevUntil).getTime() > Date.now()
        ? new Date(prevUntil).getTime()
        : Date.now();
    nextUntil = new Date(base + days * 24 * 3600 * 1000).toISOString();
  }

  const { error: upErr } = await sb
    .from("wallets")
    .update({
      contact_credits: prev + credits,
      premium_until: nextUntil,
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", input.profileId);
  if (upErr) {
    await sb.from("razorpay_payment_credits").delete().eq("razorpay_payment_id", input.paymentId);
    return { ok: false, error: upErr.message, status: 500 };
  }
  return { ok: true, already: false };
}

export async function saveSubscription(input: {
  profileId: string;
  planCode: string;
  subscriptionId: string;
  razorpayPlanId: string | null;
  status: string;
  periodEnd: string | null;
  cancelAtPeriodEnd?: boolean;
}): Promise<void> {
  const sb = getSupabaseAdmin();
  const row = {
    profile_id: input.profileId,
    plan_code: input.planCode,
    razorpay_subscription_id: input.subscriptionId,
    razorpay_plan_id: input.razorpayPlanId,
    status: input.status,
    current_period_end: input.periodEnd,
    cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
    updated_at: new Date().toISOString(),
  };
  const { data: existing } = await sb
    .from("member_subscriptions")
    .select("id")
    .eq("razorpay_subscription_id", input.subscriptionId)
    .maybeSingle();
  if (existing?.id) {
    await sb.from("member_subscriptions").update(row).eq("id", existing.id);
    return;
  }
  await sb.from("member_subscriptions").insert(row);
}

export function periodEndIso(currentEnd: unknown, fallbackDays: number): string {
  const n = typeof currentEnd === "number" ? currentEnd : Number(currentEnd);
  if (Number.isFinite(n) && n > 1_000_000_000) {
    return new Date(n * 1000).toISOString();
  }
  return new Date(Date.now() + fallbackDays * 24 * 3600 * 1000).toISOString();
}
