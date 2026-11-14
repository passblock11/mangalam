import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { SiteFooter, SiteHeader } from "@/components/chrome";

export const metadata: Metadata = { title: "How Mangalam works" };

const steps = [
  {
    image: "/photos/experience-profile.jpg",
    alt: "A woman reading a profile on her phone",
    n: "01",
    title: "Create your profile",
    copy: "Sign in with Google and add your community, city, education, partner preferences, and photos. A profile started on the phone is the same profile on the website.",
  },
  {
    image: "/photos/experience-verify.jpg",
    alt: "An identity booklet beside a phone",
    n: "02",
    title: "Verify your identity",
    copy: "Upload a selfie and a government ID. Mangalam reviews them before contact details can be shared. Verified profiles are marked in Discover.",
  },
  {
    image: "/photos/experience-family.jpg",
    alt: "A couple with parents over tea",
    n: "03",
    title: "Connect when you are ready",
    copy: "Like a profile, match, and send a message. A phone number is requested only when you allow it, and only by a verified member with an active membership.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="bg-white">
      <SiteHeader />
      <PageHero
        image="/photos/hero-couple.jpg"
        alt="A couple in a sandstone courtyard"
        title="How Mangalam works"
        subtitle="Three steps from a profile to a conversation. Membership is optional."
      />
      <main className="mx-auto max-w-6xl space-y-16 px-5 py-16">
        {steps.map((step, index) => (
          <article key={step.n} className={`grid items-center gap-8 md:grid-cols-2 ${index % 2 ? "md:[&>img]:order-2" : ""}`}>
            <img src={step.image} alt={step.alt} className="h-80 w-full rounded-2xl object-cover" />
            <div>
              <p className="text-sm font-semibold text-maroon">{step.n}</p>
              <h2 className="mt-2 text-3xl font-semibold">{step.title}</h2>
              <p className="mt-4 text-base leading-7 text-muted">{step.copy}</p>
            </div>
          </article>
        ))}
        <div className="rounded-2xl bg-[#f7f8fa] px-6 py-8 text-center">
          <h2 className="text-2xl font-semibold">Start with a search</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">Choose an age range, religion, and mother tongue. You will sign in with Google before Discover opens.</p>
          <Link href="/search" className="mt-5 inline-flex h-12 items-center rounded-md bg-maroon px-6 text-sm font-medium text-white">Partner search</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
