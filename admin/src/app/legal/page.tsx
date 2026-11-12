import type { Metadata } from "next";
import Link from "next/link";
import { fetchPublishedLegalPages } from "@/lib/public-legal";

export const metadata: Metadata = {
  title: "Mangalam — Legal",
  description: "Privacy Policy, Terms of Service, and other legal documents for the Mangalam app.",
};

export const revalidate = 60;

export default async function LegalIndexPage() {
  const pages = await fetchPublishedLegalPages();
  return (
    <main className="legal-doc">
      <p className="legal-brand">Mangalam</p>
      <h1>Legal</h1>
      <p className="legal-updated">
        Public documents for the Mangalam Android app. No sign-in is required.
      </p>
      {pages.length === 0 ? (
        <p>No documents are published yet.</p>
      ) : (
        <ul>
          {pages.map((p) => (
            <li key={p.slug}>
              <Link href={`/legal/${p.slug}`}>{p.title}</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
