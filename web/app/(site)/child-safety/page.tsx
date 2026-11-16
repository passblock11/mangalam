import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { supportEmail } from "@/lib/config";

export const metadata: Metadata = {
  title: "Child safety standards",
  description:
    "Mangalam standards against child sexual abuse and exploitation (CSAE), age limits, reporting, and contact for child safety concerns.",
};

export default function ChildSafetyPage() {
  return (
    <div className="bg-white">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-5 py-16 text-[#2c313a]">
        <Link href="/" className="text-sm text-maroon">
          Back home
        </Link>
        <p className="mt-6 text-xs tracking-[0.16em] text-gold uppercase">Mangalam</p>
        <h1 className="mt-3 text-3xl font-semibold text-[#1c212b]">Child safety standards</h1>
        <p className="mt-4 text-sm leading-6">
          Mangalam is a matrimonial service for adults. This page is our published standard against child sexual abuse
          and exploitation (CSAE), including child sexual abuse material (CSAM). It applies to the Mangalam Android
          app and the Mangalam website.
        </p>

        <h2 className="mt-10 text-lg font-semibold">Age restriction</h2>
        <p className="mt-3 text-sm leading-6">
          Mangalam is for people 18 years of age and older only. We do not offer accounts, profiles, chat, or discovery
          for children. Creating or using an account for anyone under 18 is not allowed and leads to removal.
        </p>

        <h2 className="mt-10 text-lg font-semibold">Zero tolerance for CSAE and CSAM</h2>
        <p className="mt-3 text-sm leading-6">
          We prohibit any content, profile, message, image, or behaviour that involves sexual exploitation or abuse of a
          child, including CSAM. That includes creating, sharing, requesting, storing, or directing others to such
          material. We also prohibit grooming, solicitation of a minor, and any attempt to use Mangalam to contact a
          child for sexual purposes.
        </p>

        <h2 className="mt-10 text-lg font-semibold">How we reduce risk</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">
          <li>Adults-only registration and Google sign-in.</li>
          <li>Profile review and identity verification tools for members who submit ID and a selfie.</li>
          <li>In-app and website reporting of profiles and messages.</li>
          <li>Blocking so a member can stop further contact from another account.</li>
          <li>Support tickets reviewed by the Mangalam team.</li>
          <li>Removal of accounts and content that break these standards.</li>
        </ul>

        <h2 className="mt-10 text-lg font-semibold">How to report a child safety concern</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">
          <li>
            In the app: open the profile or chat, use Report, or go to Profile → Get help &amp; support → New ticket.
            Write “Child safety” in the subject and describe what happened.
          </li>
          <li>
            By email: write to{" "}
            <a className="text-maroon" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>{" "}
            with the subject “Child safety concern”. Include links, screenshots, usernames, and dates if you have them.
          </li>
        </ol>
        <p className="mt-3 text-sm leading-6">
          Reports about possible CSAE or CSAM are treated as urgent. We review them, remove violating content and
          accounts when we confirm a breach, and keep records needed for that review.
        </p>

        <h2 className="mt-10 text-lg font-semibold">Reporting to authorities</h2>
        <p className="mt-3 text-sm leading-6">
          When the law requires it, or when we find clear evidence of CSAE or CSAM, we report to the relevant regional
          and national authorities. In India that includes the appropriate cybercrime / law-enforcement channels. We
          cooperate with lawful requests that relate to child safety.
        </p>

        <h2 className="mt-10 text-lg font-semibold">Point of contact</h2>
        <p className="mt-3 text-sm leading-6">
          Questions about these standards, CSAM prevention on Mangalam, or an active child safety report can be sent to{" "}
          <a className="text-maroon" href={`mailto:${supportEmail}`}>
            {supportEmail}
          </a>
          . This mailbox is monitored for child safety matters.
        </p>

        <h2 className="mt-10 text-lg font-semibold">Related pages</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">
          <li>
            <Link className="text-maroon" href="/safety">
              Be safe online
            </Link>
          </li>
          <li>
            <Link className="text-maroon" href="/terms">
              Terms of service
            </Link>
          </li>
          <li>
            <Link className="text-maroon" href="/privacy">
              Privacy policy
            </Link>
          </li>
          <li>
            <Link className="text-maroon" href="/help">
              Help
            </Link>
          </li>
        </ul>

        <p className="mt-10 text-xs leading-5 text-muted">
          Last updated: 16 November 2026. This page is published for Google Play child safety standards and for anyone
          who needs our CSAE policy in one place.
        </p>
      </article>
      <SiteFooter />
    </div>
  );
}
