import type { Metadata } from "next";
import { FaqList, homeFaqs } from "@/components/faq-list";
import { PageHero } from "@/components/page-hero";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { supportEmail } from "@/lib/config";

export const metadata: Metadata = { title: "Help" };

export default function HelpPage() {
  return (
    <div className="bg-white">
      <SiteHeader />
      <PageHero
        image="/photos/experience-profile.jpg"
        alt="A woman reading on her phone by a window"
        title="Help"
        subtitle="Answers about profiles, verification, membership, and payments."
      />
      <main className="mx-auto grid max-w-6xl gap-12 px-5 py-14 md:grid-cols-[1.4fr_0.6fr]">
        <FaqList items={homeFaqs} />
        <aside className="h-fit rounded-2xl border border-[#eceff3] bg-[#f7f8fa] p-6">
          <p className="text-sm font-semibold">Write to us</p>
          <a className="mt-2 block text-lg font-medium text-maroon" href={`mailto:${supportEmail}`}>{supportEmail}</a>
          <p className="mt-3 text-sm leading-6 text-muted">
            Include the Google email on the account. For a payment, include the time of the charge. Signed-in members can also open a ticket from their profile.
          </p>
        </aside>
      </main>
      <SiteFooter />
    </div>
  );
}
