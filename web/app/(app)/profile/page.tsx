"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { PhotoPicker } from "@/components/photo-picker";
import { PhotoViewer } from "@/components/photo-viewer";
import { api } from "@/lib/api";
import { t, tCatalog, tValue, useLocale } from "@/lib/i18n";
import { languages } from "@/lib/options";
import { ageOf, preferenceText, type Profile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

type Membership = {
  premium_until?: string | null;
  benefits_active?: boolean;
  membership_waived?: boolean;
  contact_credits?: number;
  subscription?: { plan_name?: string | null } | null;
};

export default function MyProfilePage() {
  useLocale();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [viewer, setViewer] = useState(false);

  useEffect(() => {
    api<{ profile: Profile | null; wallet?: { contact_credits?: number } | null }>("/v1/me").then((data) => {
      setProfile(data.profile);
      setCredits(data.wallet?.contact_credits ?? null);
    }).catch((err: Error) => setError(err.message));
    api<Membership>("/v1/payments/membership").then(setMembership).catch(() => undefined);
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? ""));
  }, []);

  async function savePhotos(urls: string[]) {
    setProfile((current) => current ? { ...current, photo_urls: urls } : current);
    await api("/v1/me", { method: "PATCH", body: { photo_urls: urls } });
  }

  if (!profile) return <p className="text-muted">{error || "Loading your profile…"}</p>;
  const photos = profile.photo_urls ?? [];
  const photo = photos[0];
  const age = ageOf(profile.date_of_birth);
  const until = membership?.premium_until ? new Date(membership.premium_until) : null;
  const active = Boolean(membership?.benefits_active || membership?.membership_waived);
  const plan = tCatalog(membership?.subscription?.plan_name || (membership?.membership_waived ? "Included" : active ? "Premium" : "No active membership"));
  const language = languages.find(([code]) => code === profile.app_language)?.[1] ?? "English";
  const place = [profile.city, profile.state].filter(Boolean).join(", ");
  const pills = [
    age ? { icon: "cake" as const, label: `${age} yrs` } : null,
    profile.community ? { icon: "users" as const, label: tValue(profile.community) } : null,
    profile.mother_tongue ? { icon: "translate" as const, label: tValue(profile.mother_tongue) } : null,
    profile.diet ? { icon: "cup" as const, label: tValue(profile.diet) } : null,
  ].filter(Boolean) as { icon: IconName; label: string }[];

  return (
    <div className="mx-auto max-w-xl">
      <div className="text-center">
        <button type="button" className="relative mx-auto h-[132px] w-[132px]" onClick={() => photos.length && setViewer(true)} aria-label="Open photos">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center rounded-full bg-[#f3e9df] text-4xl font-semibold text-maroon">{profile.display_name?.[0] || "?"}</span>
          )}
          {profile.is_verified ? <span className="absolute right-1 bottom-1 grid h-7 w-7 place-items-center rounded-full bg-gold text-white"><Icon name="check" className="h-4 w-4" /></span> : null}
        </button>
        <h1 className="mt-3 text-2xl font-semibold">{profile.display_name}</h1>
        {email ? <p className="mt-1 text-sm text-muted">{email}</p> : null}
        <p className="mt-1 text-sm font-medium">Phone: {profile.phone || "Not added"}</p>
        {pills.length ? (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {pills.map((pill) => (
              <span key={pill.label} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs">
                <Icon name={pill.icon} className="h-3.5 w-3.5 text-maroon" /> {pill.label}
              </span>
            ))}
          </div>
        ) : null}
        {place ? <p className="mt-3 inline-flex items-center gap-1 text-sm text-muted"><Icon name="location" className="h-4 w-4" /> {place}</p> : null}
        {profile.occupation ? <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted"><Icon name="briefcase" className="h-4 w-4" /> {profile.occupation}</p> : null}
      </div>

      <Link href="/edit" className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-maroon py-3 text-sm font-medium text-white">
        <Icon name="edit" className="h-4 w-4" /> {t("Edit profile")}
      </Link>

      <Link href="/verification" className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[#fff8f3] text-maroon"><Icon name="shield" /></span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block font-semibold">{profile.is_verified ? "Verified" : "Profile verification"}</span>
          <span className="block text-sm text-muted">{profile.verification_note || (profile.is_verified ? "Your identity is confirmed." : profile.verification_status || "Verify to unlock contact details.")}</span>
        </span>
        <Icon name="chevron-right" className="h-5 w-5 shrink-0 text-muted" />
      </Link>

      <h2 className="mt-6 flex items-center gap-2 text-lg font-semibold"><Icon name="camera" className="h-5 w-5 text-maroon" /> {t("Your photos")}</h2>
      <div className="mt-3">
        <PhotoPicker urls={photos} onChange={(urls) => savePhotos(urls).catch((err: Error) => setError(err.message))} />
      </div>
      {credits != null ? <p className="mt-3 text-sm text-muted">Contact credits: {credits}</p> : null}
      <p className="mt-4 text-sm leading-6 text-muted">{profile.bio || "Add a short introduction from Edit profile."}</p>
      <p className="mt-2 text-sm text-muted">Partner age {preferenceText(profile.partner_preferences?.age_min)} – {preferenceText(profile.partner_preferences?.age_max)} · {preferenceText(profile.partner_preferences?.location ?? profile.partner_preferences?.city)}</p>
      {error ? <p className="mt-3 text-sm text-maroon">{error}</p> : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
        <Menu href="/biodata" icon="document" title="Premium biodata" subtitle="Print or save as PDF" extra="FREE" />
        <Menu href="/support" icon="info" title="Get help & support" subtitle="passblock.securities@gmail.com" />
        <Menu href="/edit" icon="globe" title="App language" extra={language.split("·").pop()?.trim() || language} />
        <Menu href="/edit" icon="settings" title="Account settings" />
        <Menu href="/privacy" icon="shield" title="Privacy Policy" />
        <Menu href="/terms" icon="document" title="Terms of Service" />
        <Menu href="/refund" icon="refresh" title="Refund & Cancellation" />
        <Menu href="/about" icon="info" title="About Mangalam" last />
      </div>

      <Link href="/membership" className="mt-4 block overflow-hidden rounded-2xl border border-line bg-white">
        <span className="flex items-center gap-3 p-4">
          <span className="min-w-0 flex-1">
            {active ? <span className="mb-2 inline-block rounded-lg bg-[#18a058] px-2.5 py-1 text-xs font-semibold text-white">Active</span> : null}
            <span className="block text-sm text-muted">{t("My Membership")}</span>
            <span className="block text-lg font-semibold">{plan}</span>
          </span>
          <Icon name="arrow-right" className="h-5 w-5 shrink-0 text-muted" />
        </span>
        {until && !Number.isNaN(until.getTime()) ? (
          <span className="block border-t border-line px-4 py-3 text-sm text-muted">Valid until {until.toLocaleDateString("en-IN")}</span>
        ) : null}
      </Link>
      {viewer ? <PhotoViewer urls={photos} index={0} onClose={() => setViewer(false)} /> : null}
    </div>
  );
}

function Menu({ href, icon, title, subtitle, extra, last = false }: { href: string; icon: IconName; title: string; subtitle?: string; extra?: string; last?: boolean }) {
  return (
    <Link href={href} className={`flex items-center gap-3 px-4 py-3.5 ${last ? "" : "border-b border-line"}`}>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#fff8f3] text-maroon"><Icon name={icon} className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{t(title)}</span>
        {subtitle ? <span className="block truncate text-xs text-muted">{t(subtitle)}</span> : null}
      </span>
      {extra ? <span className="text-xs font-semibold text-gold">{t(extra)}</span> : <Icon name="chevron-right" className="h-4 w-4 text-muted" />}
    </Link>
  );
}
