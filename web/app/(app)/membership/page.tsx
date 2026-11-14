"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { openCheckout } from "@/lib/checkout";
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
};

type Membership = {
  premium_until?: string | null;
  contact_credits?: number;
  membership_waived?: boolean;
  benefits_active?: boolean;
  addons_allowed?: boolean;
  message_credit_cost?: number | null;
  message_free_per_chat?: number;
  subscription?: { plan_name?: string | null; status?: string; cancel_at_period_end?: boolean } | null;
};

export default function MembershipPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

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
      if (plan.plan_type === "subscription") {
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment could not be completed.");
    } finally {
      setBusy("");
    }
  }

  const active = Boolean(membership?.benefits_active);
  const waived = Boolean(membership?.membership_waived);
  const note = membership?.message_credit_cost
    ? membership.message_free_per_chat
      ? `Each message uses ${membership.message_credit_cost} credits after ${membership.message_free_per_chat} free messages in a chat.`
      : `Each message uses ${membership.message_credit_cost} credits.`
    : null;

  return (
    <div>
      <p className="text-xs tracking-[0.16em] text-gold uppercase">Membership</p>
      <h1 className="display text-5xl">{waived ? "Included" : active ? "Active" : "Choose a membership"}</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Contacts left" value={String(membership?.contact_credits ?? 0)} />
        <Stat label="Phone numbers" value={active || waived ? "Included" : "Locked"} />
        <Stat label="Premium" value={active || waived ? "Included" : "Locked"} />
      </div>
      {note && !waived ? <p className="mt-4 text-sm text-muted">{note}</p> : null}
      {membership?.subscription && !membership.subscription.cancel_at_period_end ? (
        <button
          className="mt-4 text-sm text-maroon"
          onClick={async () => {
            if (!window.confirm("Cancel this membership at the end of the current period?")) return;
            setError("");
            try {
              await api("/v1/payments/razorpay/subscription/cancel", { method: "POST", body: {} });
              await load();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not cancel the membership.");
            }
          }}
        >
          Cancel membership
        </button>
      ) : null}
      {error ? <p className="mt-4 text-sm text-maroon">{error}</p> : null}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {plans.map((plan) => {
          const addon = plan.plan_type === "credits" || ((plan.duration_days ?? 0) <= 0 && (plan.credits ?? 0) > 0);
          const locked = addon && !membership?.addons_allowed;
          return (
            <article key={plan.code} className="rounded-3xl border border-line bg-white p-6">
              <h2 className="display text-3xl">{plan.name}</h2>
              <p className="mt-2 text-2xl font-semibold text-maroon">{inr(plan.price_paise)}</p>
              <p className="mt-2 text-sm text-muted">{plan.description}</p>
              <button disabled={Boolean(busy) || locked} className="mt-5 rounded-full bg-maroon px-4 py-2 text-sm text-white disabled:opacity-40" onClick={() => buy(plan)}>
                {busy === plan.code ? "Opening…" : locked ? "Buy a membership first" : addon ? "Buy contact credits" : "Choose a membership"}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white px-4 py-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 font-medium">{value}</p></div>;
}
