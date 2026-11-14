import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { publicConfig } from "@/lib/config";
import { inr } from "@/lib/profile";

export const metadata: Metadata = { title: "Membership" };

type Plan = {
  code: string;
  name: string;
  description?: string | null;
  plan_type?: string;
  price_paise: number;
  credits?: number | null;
  duration_days?: number | null;
  is_active?: boolean | null;
};

export default async function PricingPage() {
  const res = await fetch(`${publicConfig.apiBase}/v1/config/plans`, { next: { revalidate: 120 } });
  const data = res.ok ? ((await res.json()) as { plans?: Plan[] }) : { plans: [] };
  const plans = (data.plans ?? []).filter((plan) => plan.is_active !== false && plan.plan_type !== "credits");

  return (
    <div className="bg-white">
      <SiteHeader />
      <PageHero
        image="/photos/experience-family.jpg"
        alt="A family sitting together in a bright living room"
        title="Membership"
        subtitle="A membership opens paid features. Prices are charged in Indian rupees through Razorpay after you sign in."
      />
      <main className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <article key={plan.code} className="rounded-2xl border border-[#eceff3] bg-white p-6 shadow-sm">
              <p className="text-xs font-medium tracking-wide text-muted uppercase">
                {plan.plan_type === "subscription" ? "Renewing membership" : "Membership"}
              </p>
              <h2 className="mt-2 text-2xl font-semibold">{plan.name}</h2>
              <p className="mt-3 text-3xl font-semibold text-maroon">{inr(plan.price_paise)}</p>
              <p className="mt-3 text-sm leading-6 text-muted">
                {plan.description || "Available after you sign in."}
                {plan.duration_days ? ` ${plan.duration_days} days.` : ""}
              </p>
              <Link href="/login" className="mt-5 inline-flex h-11 items-center rounded-md bg-maroon px-5 text-sm font-medium text-white">Continue</Link>
            </article>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
