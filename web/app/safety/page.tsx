import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { supportEmail } from "@/lib/config";

export const metadata: Metadata = { title: "Be safe online" };

const points = [
  ["Never share an OTP", "Mangalam will not ask you to read out a one-time password, a Google code, or a bank PIN. A person who asks for one is not from Mangalam."],
  ["Keep money inside Razorpay", "Memberships and contact credits are charged on this website or in the app through Razorpay. Do not transfer money to a personal account because someone asks you to."],
  ["Meet in a public place", "When you decide to meet, choose a public place and tell a family member. Mangalam does not send a representative to a meeting."],
  ["Report a profile", "Open the profile and report it, or write to support. You can also block someone so they cannot message you."],
];

export default function SafetyPage() {
  return (
    <div className="bg-white">
      <SiteHeader />
      <PageHero
        image="/photos/experience-verify.jpg"
        alt="A closed identity booklet on a desk"
        title="Be safe online"
        subtitle="Verification, private numbers, and a way to report misuse."
      />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <div className="space-y-8">
          {points.map(([title, copy]) => (
            <article key={title}>
              <h2 className="text-2xl font-semibold">{title}</h2>
              <p className="mt-2 text-base leading-7 text-muted">{copy}</p>
            </article>
          ))}
        </div>
        <p className="mt-10 text-sm leading-6 text-muted">
          Signed-in members can open a ticket from their profile. You can also write to <a className="text-maroon" href={`mailto:${supportEmail}`}>{supportEmail}</a>.
        </p>
        <Link href="/help" className="mt-6 inline-flex text-sm font-medium text-maroon">Customer support</Link>
      </main>
      <SiteFooter />
    </div>
  );
}
