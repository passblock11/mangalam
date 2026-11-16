import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { supportEmail } from "@/lib/config";

export const metadata: Metadata = { title: "Delete your Mangalam account" };

export default function DeleteAccountPage() {
  return (
    <div className="bg-white">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-5 py-16 text-[#2c313a]">
        <Link href="/" className="text-sm text-maroon">Back home</Link>
        <p className="mt-6 text-xs tracking-[0.16em] text-gold uppercase">Mangalam</p>
        <h1 className="mt-3 text-3xl font-semibold text-[#1c212b]">Delete your Mangalam account</h1>
        <p className="mt-4 text-sm leading-6">
          This page is for the Mangalam matrimonial app and the Mangalam website. You can ask us to delete your account and the data stored with it by email, or from inside the app.
        </p>

        <h2 className="mt-8 text-lg font-semibold">Request by email</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">
          <li>Send an email to <a className="text-maroon" href={`mailto:${supportEmail}`}>{supportEmail}</a>.</li>
          <li>Use the subject line “Delete my Mangalam account”.</li>
          <li>Send it from the Gmail address you use to sign in. Include your profile name and registered mobile number.</li>
        </ol>

        <h2 className="mt-8 text-lg font-semibold">Request in the app</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">
          <li>Open Mangalam and go to the Profile tab.</li>
          <li>Tap <strong>Get help &amp; support</strong>.</li>
          <li>Tap <strong>New ticket</strong>.</li>
          <li>Leave Topic as <strong>Account</strong>.</li>
          <li>Subject: “Delete my Mangalam account”.</li>
          <li>In “What happened?”, ask us to delete your account and the data stored with it. Include your profile name and registered mobile number.</li>
          <li>Tap <strong>Send ticket</strong>. The button is the red button under the message box.</li>
        </ol>
        <p className="mt-4 text-sm leading-6">
          We delete the account after we confirm the request, whether it arrives by email or as a support ticket. This is completed within 30 days.
        </p>

        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          <figure>
            <img
              src="/delete-account/profile-support.png"
              alt="Profile screen with Get help and support highlighted in the menu"
              className="w-full rounded-2xl border border-[#eadfd4]"
            />
            <figcaption className="mt-2 text-xs leading-5 text-[#6B6258]">1. Profile, then Get help &amp; support</figcaption>
          </figure>
          <figure>
            <img
              src="/delete-account/support.png"
              alt="Support screen with the New ticket button"
              className="w-full rounded-2xl border border-[#eadfd4]"
            />
            <figcaption className="mt-2 text-xs leading-5 text-[#6B6258]">2. Tap New ticket</figcaption>
          </figure>
          <figure>
            <img
              src="/delete-account/new-ticket.png"
              alt="New ticket form with Topic set to Account and a deletion request filled in"
              className="w-full rounded-2xl border border-[#eadfd4]"
            />
            <figcaption className="mt-2 text-xs leading-5 text-[#6B6258]">3. Topic Account, then send the ticket</figcaption>
          </figure>
        </div>

        <h2 className="mt-8 text-lg font-semibold">What we delete</h2>
        <p className="mt-3 text-sm leading-6">
          Your profile, photos, government ID and selfie used for verification, messages, likes, matches, shortlists, and notification records.
        </p>
        <h2 className="mt-8 text-lg font-semibold">What we may keep</h2>
        <p className="mt-3 text-sm leading-6">
          Payment records are kept for as long as Indian tax and accounting law requires. We also keep a record of the deletion request itself. Those records are not used to restore your profile.
        </p>
      </article>
      <SiteFooter />
    </div>
  );
}
