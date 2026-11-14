import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { Markdown } from "@/components/markdown";
import { publicConfig } from "@/lib/config";

const titles: Record<string, string> = {
  privacy: "Privacy policy",
  terms: "Terms of service",
  refund: "Refund and cancellation",
  about: "About Mangalam",
};

export function generateStaticParams() {
  return Object.keys(titles).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: titles[slug] ?? "Mangalam" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!titles[slug]) notFound();
  const res = await fetch(`${publicConfig.apiBase}/v1/config/legal/${slug}`, { next: { revalidate: 120 } });
  if (!res.ok) notFound();
  const data = (await res.json()) as { page?: { title?: string; body?: string; updated_at?: string } };
  const page = data.page;
  if (!page?.body) notFound();
  return (
    <div className="bg-white">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-5 py-16">
        <Link href="/" className="text-sm text-maroon">Back home</Link>
        <p className="mt-6 text-xs tracking-[0.16em] text-gold uppercase">Mangalam</p>
        <div className="mt-3">
          <Markdown source={page.body} />
        </div>
        {page.updated_at ? (
          <p className="mt-10 text-xs text-muted">Updated {page.updated_at.slice(0, 10)}</p>
        ) : null}
      </article>
      <SiteFooter />
    </div>
  );
}
