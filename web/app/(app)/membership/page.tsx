"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { api } from "@/lib/api";
import { openCashfreeCheckout, openCheckout } from "@/lib/checkout";
import { t, tCatalog, tf, useLocale } from "@/lib/i18n";
import { inr } from "@/lib/profile";

type Plan = {
  code: string;
  name: string;
  description?: string | null;
  plan_type?: string;
  price_paise: number;
  is_active?: boolean;
  duration_days?: number | null;
  credits?: number | null;
  billing_period?: string | null;
};

type Payment = {
  id?: string;
  amount_paise?: number;
  credits?: number;
  premium_days?: number;
  plan_name?: string | null;
  billing_period?: string | null;
  created_at?: string | null;
};

type Subscription = {
  plan_name?: string | null;
  status?: string;
  cancel_at_period_end?: boolean;
  billing_period?: string | null;
  duration_days?: number | null;
  plan_credits?: number;
};

type Membership = {
  premium_until?: string | null;
  contact_credits?: number;
  membership_waived?: boolean;
  benefits_active?: boolean;
  addons_allowed?: boolean;
  message_credit_cost?: number | null;
  message_free_per_chat?: number;
  subscription?: Subscription | null;
  payments?: Payment[];
};

async function verifyCashfreePaid(path: string, body: Record<string, string>) {
  let last: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await api(path, { method: "POST", body });
      return;
    } catch (error) {
      last = error;
      const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      if (!message.includes("not confirmed") || attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 + attempt * 1000));
    }
  }
  throw last;
}

function periodLabel(billing?: string | null, days?: number | null): string {
  if (billing === "quarterly" || (days != null && days >= 80 && days <= 100)) return t("3 months");
  if (billing === "yearly" || (days != null && days >= 360 && days <= 366)) return t("1 year");
  if (billing === "monthly" || (days != null && days >= 28 && days <= 31)) return t("1 month");
  if (days != null && days > 0) return `${days} ${t("days")}`;
  return "";
}

function shortDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB");
}

export default function MembershipPage() {
  useLocale();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [sheet, setSheet] = useState<"membership" | "credits" | null>(null);

  async function load() {
    const [planRes, memberRes] = await Promise.all([
      api<{ plans?: Plan[] }>("/v1/config/plans"),
      api<Membership>("/v1/payments/membership"),
    ]);
    setPlans((planRes.plans ?? []).filter((plan) => plan.is_active !== false));
    setMembership(memberRes);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function buy(plan: Plan) {
    setBusy(plan.code);
    setError("");
    try {
      const gateway = await api<{ provider?: string }>("/v1/payments/cashfree/gateway");
      if (gateway.provider === "cashfree") {
        if (plan.plan_type === "subscription") {
          const started = await api<{ environment: "sandbox" | "production"; subscription_id: string; subscription_session_id: string }>("/v1/payments/cashfree/subscribe", {
            method: "POST",
            body: { plan_code: plan.code },
          });
          await openCashfreeCheckout({ environment: started.environment, subscriptionSessionId: started.subscription_session_id });
          await verifyCashfreePaid("/v1/payments/cashfree/verify-subscription", { subscription_id: started.subscription_id });
        } else {
          const order = await api<{ environment: "sandbox" | "production"; order_id: string; payment_session_id: string }>("/v1/payments/cashfree/order", {
            method: "POST",
            body: { plan_code: plan.code },
          });
          await openCashfreeCheckout({ environment: order.environment, paymentSessionId: order.payment_session_id });
          await verifyCashfreePaid("/v1/payments/cashfree/verify", { order_id: order.order_id });
        }
      } else if (plan.plan_type === "subscription") {
        const started = await api<{ key_id: string; subscription_id: string }>("/v1/payments/razorpay/subscribe", {
          method: "POST",
          body: { plan_code: plan.code },
        });
        const paid = await openCheckout({
          key: started.key_id,
          subscription_id: started.subscription_id,
          name: "Mangalam",
          description: plan.name,
        });
        await api("/v1/payments/razorpay/verify-subscription", {
          method: "POST",
          body: {
            razorpay_subscription_id: paid.razorpay_subscription_id,
            razorpay_payment_id: paid.razorpay_payment_id,
            razorpay_signature: paid.razorpay_signature,
          },
        });
      } else {
        const order = await api<{ key_id: string; order_id: string; amount_paise: number; currency: string }>("/v1/payments/razorpay/order", {
          method: "POST",
          body: { plan_code: plan.code },
        });
        const paid = await openCheckout({
          key: order.key_id,
          order_id: order.order_id,
          amount: order.amount_paise,
          currency: order.currency,
          name: "Mangalam",
          description: plan.name,
        });
        await api("/v1/payments/razorpay/verify", {
          method: "POST",
          body: {
            razorpay_order_id: paid.razorpay_order_id,
            razorpay_payment_id: paid.razorpay_payment_id,
            razorpay_signature: paid.razorpay_signature,
          },
        });
      }
      await api("/v1/me", { method: "PATCH", body: { preferences: { membership_pending: false } } });
      setSheet(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment could not be completed.");
    } finally {
      setBusy("");
    }
  }

  if (!membership && !error) return <p className="text-muted">{t("Please wait…")}</p>;

  const sub = membership?.subscription;
  const active = Boolean(membership?.benefits_active);
  const waived = Boolean(membership?.membership_waived);
  const benefits = waived || active;
  const credits = membership?.contact_credits ?? 0;
  const allowance = sub?.plan_credits ?? 0;
  const contactValue = allowance > credits && allowance > 0 ? `${credits}/${allowance}` : String(credits);
  const cost = membership?.message_credit_cost;
  const free = membership?.message_free_per_chat ?? 0;
  const messageValue = waived || cost == null || cost <= 0 ? t("Included") : tf("{n} credits", { n: String(cost) });
  const messageNote = !waived && cost != null && cost > 0
    ? free > 0
      ? tf("Each message uses {n} credits after {free} free messages in a chat.", { n: String(cost), free: String(free) })
      : tf("Each message uses {n} credits.", { n: String(cost) })
    : null;
  const planName = sub?.plan_name?.trim()
    ? tCatalog(sub.plan_name)
    : waived && !active
      ? t("Included")
      : active
        ? t("Premium")
        : t("No active membership");
  const period = periodLabel(sub?.billing_period, sub?.duration_days);
  const until = membership?.premium_until ? new Date(membership.premium_until) : null;
  const untilText = until && !Number.isNaN(until.getTime()) ? until.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
  const untilLine = untilText
    ? sub?.cancel_at_period_end
      ? `${t("Ends on")} ${untilText}`
      : sub?.status === "active" || sub?.status === "authenticated"
        ? `${t("Renews on")} ${untilText}`
        : `${t("Membership expiring on")} ${untilText}`
    : "";
  const payments = membership?.payments ?? [];
  const canCancel = Boolean(sub && !sub.cancel_at_period_end && ["active", "authenticated", "pending"].includes(sub.status || ""));
  const shown = sheet === "membership"
    ? plans.filter((plan) => plan.plan_type === "subscription" || plan.plan_type === "one_time")
    : plans.filter((plan) => plan.plan_type === "credits");

  return (
    <div className="mx-auto max-w-lg">
      <section className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
        <div className="flex items-start gap-3 bg-[#fff6d8] px-4 py-4">
          <div className="min-w-0 flex-1">
            {benefits ? <span className="mb-2 inline-block rounded-lg bg-[#18a058] px-2.5 py-1 text-xs font-semibold text-white">{t("Active")}</span> : null}
            <p className="text-xl font-extrabold">{planName}</p>
            {period ? <p className="mt-1 text-[15px]">{period}</p> : null}
          </div>
          <span className="grid h-[46px] w-[46px] place-items-center rounded-full bg-gold text-white">
            <Icon name="crown" className="h-6 w-6" />
          </span>
        </div>
        {untilLine ? (
          <p className="flex items-center gap-2 bg-[#f3f6fb] px-4 py-3 text-[13px] font-semibold text-[#3d4a63]">
            <Icon name="clock" className="h-4 w-4 text-muted" /> {untilLine}
          </p>
        ) : null}
      </section>

      <h2 className="mt-6 text-lg font-extrabold">{t("Package usage")}</h2>
      <section className="mt-2.5 overflow-hidden rounded-2xl border border-[#e7e2dc] bg-white">
        <Usage icon="phone" label={t("Contacts left")} value={contactValue} />
        <Usage icon="phone" label={t("Phone numbers")} value={benefits ? t("Included") : t("Locked")} />
        <Usage icon="message" label={t("Messages")} value={messageValue} />
        <Usage icon="crown" label={t("Premium")} value={benefits ? t("Included") : t("Locked")} last />
        {messageNote ? <p className="px-4 pb-3.5 text-[12.5px] leading-5 text-muted">{messageNote}</p> : null}
      </section>

      {payments[0] ? (
        <>
          <h2 className="mt-6 text-lg font-extrabold">{t("Payment status")}</h2>
          <section className="mt-2.5 flex items-center gap-3 rounded-2xl border border-[#e7e2dc] bg-white p-4">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#18a058] text-white"><Icon name="check" className="h-5 w-5" /></span>
            <span>
              <span className="block text-[15px] font-extrabold">{t("Amount debited successfully")}</span>
              <span className="block text-[13px] text-muted">{inr(payments[0].amount_paise ?? 0)} {t("debited on")} {shortDate(payments[0].created_at)}</span>
            </span>
          </section>
        </>
      ) : null}

      <h2 className="mt-6 text-lg font-extrabold">{t("All transactions")}</h2>
      {payments.length === 0 ? (
        <p className="mt-2.5 rounded-2xl border border-[#e7e2dc] bg-white p-4 text-muted">{t("No payments yet")}</p>
      ) : (
        <div className="mt-2.5 space-y-2.5">
          {payments.map((payment) => {
            const name = payment.plan_name?.trim()
              ? tCatalog(payment.plan_name)
              : (payment.credits ?? 0) > 0
                ? t("Contact credits")
                : t("Premium");
            const detail = periodLabel(payment.billing_period, payment.premium_days) || ((payment.credits ?? 0) > 0 ? `${payment.credits} ${t("credits")}` : "");
            return (
              <article key={payment.id || `${payment.created_at}-${payment.amount_paise}`} className="flex items-center gap-3 rounded-2xl border border-[#e7e2dc] bg-white px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-extrabold">{name}</p>
                  {detail ? <p className="text-[13px] text-muted">{detail}</p> : null}
                </div>
                <div className="text-right">
                  <p className="text-base font-extrabold text-maroon">−{inr(payment.amount_paise ?? 0)}</p>
                  <p className="text-xs text-muted">{shortDate(payment.created_at)}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {error ? <p className="mt-4 text-sm text-maroon">{error}</p> : null}
      <div className="mt-6 space-y-2">
        {!benefits ? (
          <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-maroon text-sm font-semibold text-white" onClick={() => setSheet("membership")}>
            <Icon name="crown" className="h-4 w-4" /> {t("Choose a membership")}
          </button>
        ) : null}
        {membership?.addons_allowed ? (
          <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-maroon text-sm font-semibold text-maroon" onClick={() => setSheet("credits")}>
            {t("Buy contact credits")}
          </button>
        ) : null}
        {canCancel ? (
          <button
            className="h-11 w-full text-sm font-semibold text-maroon"
            onClick={async () => {
              const when = untilText || t("the paid date");
              if (!window.confirm(`${t("Cancel membership")}\n${t("Renewal stops after this period. You keep membership until")} ${when}.`)) return;
              setError("");
              try {
                await api("/v1/payments/razorpay/subscription/cancel", { method: "POST", body: {} });
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not cancel the membership.");
              }
            }}
          >
            {t("Cancel membership")}
          </button>
        ) : null}
      </div>

      {sheet ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => !busy && setSheet(null)}>
          <div className="max-h-[70vh] w-full max-w-lg overflow-auto rounded-t-3xl bg-white p-5" onClick={(event) => event.stopPropagation()}>
            <p className="text-xl font-extrabold">{sheet === "membership" ? t("Choose a membership") : t("Buy contact credits")}</p>
            <p className="mt-1 text-[13px] leading-5 text-muted">
              {sheet === "membership"
                ? t("Membership renews by UPI or card until you cancel. You keep access until the date you already paid for.")
                : t("Credit packs are a one-time add-on. They do not renew.")}
            </p>
            <div className="mt-4 space-y-2.5">
              {shown.length === 0 ? <p className="py-6 text-center text-sm text-muted">{t("No plans are available right now. Please check back later or contact support.")}</p> : null}
              {shown.map((plan) => (
                <button key={plan.code} disabled={Boolean(busy)} className="flex w-full items-center gap-3 rounded-2xl border border-[#e7e2dc] p-3.5 text-left disabled:opacity-60" onClick={() => buy(plan)}>
                  <span className="grid h-[42px] w-[42px] place-items-center rounded-xl bg-gold/15 text-gold"><Icon name="crown" className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-extrabold">{tCatalog(plan.name)}</span>
                    <span className="block text-[13px] text-muted">{plan.description || periodLabel(plan.billing_period, plan.duration_days)}</span>
                  </span>
                  <span className="font-extrabold text-maroon">{busy === plan.code ? t("Please wait…") : inr(plan.price_paise)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Usage({ icon, label, value, last = false }: { icon: "phone" | "message" | "crown"; label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-4 ${last ? "" : "border-b border-[#e7e2dc]"}`}>
      <Icon name={icon} className="h-5 w-5" />
      <span className="flex-1 text-[15px] font-semibold">{label}</span>
      <span className="text-base font-extrabold">{value}</span>
    </div>
  );
}
