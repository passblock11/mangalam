"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { ageOf, photoOf, preferenceText, type Profile } from "@/lib/profile";

export default function BiodataPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    api<{ profile: Profile | null }>("/v1/me").then((data) => setProfile(data.profile));
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? ""));
  }, []);

  if (!profile) return <p className="text-muted">Preparing your biodata…</p>;
  const partner = profile.partner_preferences ?? {};
  const photo = photoOf(profile);
  const sections: Array<[string, Array<[string, string]>]> = [
    ["Personal", [
      ["Profile for", profile.profile_for || ""],
      ["Gender", profile.gender || ""],
      ["Age", ageOf(profile.date_of_birth)?.toString() || ""],
      ["Date of birth", profile.date_of_birth || ""],
      ["Height", profile.height_cm ? `${profile.height_cm} cm` : ""],
      ["Marital status", profile.marital_status || ""],
      ["Location", [profile.city, profile.state].filter(Boolean).join(", ")],
    ]],
    ["Community", [
      ["Religion", profile.religion || ""],
      ["Community", profile.community || ""],
      ["Mother tongue", profile.mother_tongue || ""],
      ["Diet", profile.diet || ""],
    ]],
    ["Education and career", [
      ["Education", profile.education_level || ""],
      ["Occupation", profile.occupation || ""],
      ["Monthly salary", profile.monthly_salary || ""],
    ]],
    ["Astrology", [
      ["Mangal dosh", profile.mangal_dosh || ""],
      ["Birth time", profile.birth_time || ""],
      ["Birth place", profile.birth_place || ""],
    ]],
    ["Partner preference", [
      ["Age", `${preferenceText(partner.age_min)} – ${preferenceText(partner.age_max)}`],
      ["Location", preferenceText(partner.location)],
      ["Height", preferenceText(partner.height)],
      ["Diet", preferenceText(partner.diet)],
      ["Marital status", preferenceText(partner.marital_status)],
      ["Mother tongue", preferenceText(partner.mother_tongue)],
      ["Occupation", preferenceText(partner.occupation)],
      ["Education", preferenceText(partner.education_level)],
    ]],
    ["Contact", [
      ["Phone", profile.phone || ""],
      ["Email", email],
      ["WhatsApp", profile.whatsapp_number || ""],
    ]],
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-3xl font-semibold">Marriage biodata</h1>
        <button className="rounded-md bg-maroon px-4 py-2 text-sm text-white" onClick={() => window.print()}>Download / print</button>
      </div>
      <article className="mx-auto max-w-3xl bg-[#fff8f3] p-8 text-ink">
        <div className="flex items-center justify-between rounded-lg bg-maroon px-4 py-3 text-white">
          <p className="text-sm font-semibold tracking-[0.2em] text-gold">MANGALAM</p>
          <p className="text-sm">Marriage biodata</p>
        </div>
        <div className="mt-6 flex gap-6">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-36 w-28 rounded-lg object-cover" />
          ) : null}
          <div>
            <h2 className="text-3xl font-semibold">{profile.display_name}</h2>
            {profile.is_verified ? <p className="mt-1 text-sm text-maroon">Verified</p> : null}
            {profile.bio ? <p className="mt-3 text-sm leading-6">{profile.bio}</p> : null}
          </div>
        </div>
        {sections.map(([title, rows]) => (
          <section key={title} className="mt-6">
            <h3 className="border-b border-[#e7d8c8] pb-1 text-sm font-semibold tracking-wide text-maroon uppercase">{title}</h3>
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {rows.filter(([, value]) => value && value !== "All Ok" && value !== "All Ok – All Ok").map(([label, value]) => (
                <div key={label}><dt className="text-muted">{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          </section>
        ))}
      </article>
    </div>
  );
}
