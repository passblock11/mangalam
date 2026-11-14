"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ageOf, photoOf, preferenceText, type Profile } from "@/lib/profile";
import { uploadPhoto } from "@/lib/upload";

type Membership = { premium_until?: string | null; benefits_active?: boolean; membership_waived?: boolean; contact_credits?: number };

export default function MyProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ profile: Profile | null; wallet?: { contact_credits?: number } | null }>("/v1/me").then((data) => {
      setProfile(data.profile);
      setCredits(data.wallet?.contact_credits ?? null);
    }).catch((err: Error) => setError(err.message));
    api<Membership>("/v1/payments/membership").then(setMembership).catch(() => undefined);
  }, []);

  async function savePhotos(urls: string[]) {
    setProfile((current) => current ? { ...current, photo_urls: urls } : current);
    await api("/v1/me", { method: "PATCH", body: { photo_urls: urls } });
  }

  if (!profile) return <p className="text-muted">{error || "Loading your profile…"}</p>;
  const photo = photoOf(profile);
  const partner = profile.partner_preferences ?? {};
  const until = membership?.premium_until ? new Date(membership.premium_until) : null;
  const membershipLabel = membership?.membership_waived ? "Included" : membership?.benefits_active ? "Active" : "No active membership";
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="overflow-hidden rounded-3xl border border-line bg-white">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="aspect-[3/4] w-full object-cover" />
        ) : null}
        <div className="p-5">
          <h1 className="text-3xl font-semibold">{profile.display_name}</h1>
          <p className="mt-1 text-sm text-muted">{ageOf(profile.date_of_birth) ? `${ageOf(profile.date_of_birth)} · ` : ""}{[profile.city, profile.state].filter(Boolean).join(", ")}</p>
          {profile.is_verified ? <p className="mt-2 text-sm font-medium text-maroon">Verified</p> : <p className="mt-2 text-sm text-muted">{profile.verification_status || "Not verified"}</p>}
        </div>
      </div>
      <div>
        <div className="flex flex-wrap gap-3">
          <Link className="rounded-md bg-maroon px-4 py-2 text-sm text-white" href="/edit">Edit profile</Link>
          <Link className="rounded-md border border-line bg-white px-4 py-2 text-sm" href="/membership">Membership</Link>
          <Link className="rounded-md border border-line bg-white px-4 py-2 text-sm" href="/verification">Verification</Link>
          <Link className="rounded-md border border-line bg-white px-4 py-2 text-sm" href="/biodata">Biodata</Link>
          <Link className="rounded-md border border-line bg-white px-4 py-2 text-sm" href="/support">Support</Link>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Info label="Membership" value={membershipLabel} />
          <Info label="Valid until" value={until && !Number.isNaN(until.getTime()) ? until.toLocaleDateString("en-IN") : "—"} />
          <Info label="Contact credits" value={credits == null ? "—" : String(credits)} />
          <Info label="Phone" value={profile.phone || "Not added"} />
          <Info label="Religion" value={profile.religion || "—"} />
          <Info label="Community" value={profile.community || "—"} />
          <Info label="Education" value={profile.education_level || "—"} />
          <Info label="Occupation" value={profile.occupation || "—"} />
          <Info label="Partner age" value={`${preferenceText(partner.age_min ?? partner.min_age)} – ${preferenceText(partner.age_max ?? partner.max_age)}`} />
          <Info label="Partner location" value={preferenceText(partner.location ?? partner.city)} />
        </div>
        <p className="mt-6 leading-7 text-muted">{profile.bio || "Add a short introduction from Edit profile."}</p>
        {profile.verification_note ? <p className="mt-3 text-sm text-maroon">{profile.verification_note}</p> : null}
        <h2 className="mt-8 text-xl font-semibold">Your photos</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {(profile.photo_urls ?? []).map((url) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-28 w-24 rounded-xl object-cover" />
              <button className="absolute top-1 right-1 rounded-full bg-white px-2 text-xs" onClick={() => savePhotos((profile.photo_urls ?? []).filter((item) => item !== url)).catch((err: Error) => setError(err.message))}>Remove</button>
            </div>
          ))}
        </div>
        <input className="mt-3 text-sm" type="file" accept="image/*" onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            const url = await uploadPhoto(file, "profile-photos");
            await savePhotos([...(profile.photo_urls ?? []), url].slice(0, 6));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not upload the photo.");
          }
        }} />
        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link className="text-maroon" href="/privacy">Privacy</Link>
          <Link className="text-maroon" href="/terms">Terms</Link>
          <Link className="text-maroon" href="/refund">Refunds</Link>
          <Link className="text-maroon" href="/about">About</Link>
        </div>
        {error ? <p className="mt-4 text-sm text-maroon">{error}</p> : null}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}
