import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { HomeSearch } from "@/components/home-search";

export const metadata: Metadata = { title: "Partner search" };

export default function SearchPage() {
  return (
    <div className="bg-white">
      <SiteHeader />
      <PageHero
        image="/photos/hero-couple.jpg"
        alt="A couple in a sandstone courtyard"
        title="Partner search"
        subtitle="Choose who you are looking for. After you sign in, Discover opens with these filters."
      />
      <main className="mx-auto grid max-w-6xl items-start gap-10 px-5 py-14 md:grid-cols-[1.1fr_0.9fr]">
        <HomeSearch />
        <aside className="space-y-4 text-sm leading-7 text-muted">
          <h2 className="text-2xl font-semibold text-ink">What the search uses</h2>
          <p>Age, religion, and mother tongue are applied to Discover. Mangalam already shows profiles of the opposite gender, so “I’m looking for” is saved with your search.</p>
          <p>Community, city, and verification can be refined after you sign in. Phone numbers are never part of search results.</p>
          <Link href="/communities" className="inline-block font-medium text-maroon">Browse by community</Link>
        </aside>
      </main>
      <SiteFooter />
    </div>
  );
}
