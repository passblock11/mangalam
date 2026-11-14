import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { supportEmail } from "@/lib/config";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="bg-white">
      <SiteHeader />
      <PageHero
        image="/photos/story-garden.jpg"
        alt="A couple standing in a garden at dusk"
        title="Contact"
        subtitle="Write to us about an account, a payment, verification, or a membership."
      />
      <main className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-2">
        <div className="rounded-2xl border border-[#eceff3] p-8">
          <p className="text-sm font-medium text-muted">Email</p>
          <a className="mt-2 block text-2xl font-semibold text-maroon" href={`mailto:${supportEmail}`}>{supportEmail}</a>
          <p className="mt-4 text-sm leading-7 text-muted">
            This is the same address shown in the Mangalam app. Signed-in members can also open a support ticket from their profile.
          </p>
        </div>
        <div className="rounded-2xl bg-[#f7f8fa] p-8 text-sm leading-7">
          <p><span className="text-muted">Business:</span> Mangalam, an individual software platform</p>
          <p className="mt-3"><span className="text-muted">Product:</span> Matrimonial memberships and contact credits</p>
          <p className="mt-3"><span className="text-muted">Customers:</span> Adults looking for marriage</p>
          <p className="mt-3"><span className="text-muted">Channel:</span> Mobile app and this website</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
