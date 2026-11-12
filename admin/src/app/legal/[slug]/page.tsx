import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPublishedLegalPage, markdownToHtml } from "@/lib/public-legal";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchPublishedLegalPage(slug);
  if (!page) return { title: "Not found — Mangalam" };
  return {
    title: `${page.title} — Mangalam`,
    description: `${page.title} for the Mangalam matrimonial app.`,
  };
}

export default async function LegalSlugPage({ params }: Props) {
  const { slug } = await params;
  const page = await fetchPublishedLegalPage(slug);
  if (!page) notFound();
  const updated = page.updated_at ? page.updated_at.slice(0, 10) : "";
  const html = markdownToHtml(page.body ?? "");
  return (
    <main className="legal-doc">
      <p className="legal-brand">
        <Link href="/legal">Mangalam</Link>
      </p>
      <h1>{page.title}</h1>
      {updated ? <p className="legal-updated">Last updated {updated}</p> : null}
      <article dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
