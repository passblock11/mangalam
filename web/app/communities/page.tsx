import type { Metadata } from "next";
import { CommunityIndex } from "@/components/community-index";
import { PageHero } from "@/components/page-hero";
import { SiteFooter, SiteHeader } from "@/components/chrome";

export const metadata: Metadata = { title: "Communities" };

export default function CommunitiesPage() {
  return (
    <div className="bg-white">
      <SiteHeader />
      <PageHero
        image="/photos/experience-family.jpg"
        alt="A family sitting together in a living room"
        title="Browse by community"
        subtitle="Pick a community. After you sign in, Discover shows profiles that match it."
      />
      <main className="mx-auto max-w-6xl px-5 py-14">
        <CommunityIndex />
      </main>
      <SiteFooter />
    </div>
  );
}
