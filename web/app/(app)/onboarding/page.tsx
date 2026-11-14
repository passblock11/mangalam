"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { communities } from "@/lib/communities";
import { diets, educationLevels, genders, maritalStatuses, motherTongues, occupations, profileForOptions, religions, salaryRanges, states } from "@/lib/options";
import { uploadPhoto } from "@/lib/upload";

export default function OnboardingPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [form, setForm] = useState({
    profile_for: "Self",
    display_name: "",
    gender: "male",
    date_of_birth: "",
    phone: "",
    religion: "Hindu",
    community: "",
    mother_tongue: "Hindi",
    diet: "Vegetarian",
    marital_status: "Never married",
    city: "",
    state: "Maharashtra",
    education_level: "Bachelor's",
    occupation: "Software / IT",
    monthly_salary: "Prefer not to say",
    height_cm: "165",
    bio: "",
  });
  const matches = useMemo(
    () => communities.filter((name) => name.toLowerCase().includes(query.toLowerCase())).slice(0, 8),
    [query],
  );

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="mx-auto max-w-2xl"
      onSubmit={async (event) => {
        event.preventDefault();
        if (photos.length === 0) {
          setError("Add at least one photo.");
          return;
        }
        setBusy(true);
        setError("");
        try {
          const photo_urls: string[] = [];
          for (const file of photos.slice(0, 6)) photo_urls.push(await uploadPhoto(file, "profile-photos"));
          await api("/v1/me", {
            method: "PATCH",
            body: {
              ...form,
              height_cm: Number(form.height_cm),
              country: "India",
              photo_urls,
              preferences: { membership_pending: true },
            },
          });
          router.replace("/membership");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save your profile.");
          setBusy(false);
        }
      }}
    >
      <p className="text-xs tracking-[0.16em] text-gold uppercase">Registration</p>
      <h1 className="display text-5xl">Tell us about you</h1>
      <div className="mt-6 grid gap-4">
        <Select label="Profile for" value={form.profile_for} options={profileForOptions} onChange={(value) => set("profile_for", value)} />
        <Field label="Name" value={form.display_name} onChange={(value) => set("display_name", value)} />
        <Select label="Gender" value={form.gender} options={genders.map((item) => item.value)} onChange={(value) => set("gender", value)} />
        <label className="text-sm">Date of birth<input required type="date" className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} /></label>
        <Field label="Phone" value={form.phone} onChange={(value) => set("phone", value)} />
        <Select label="Religion" value={form.religion} options={religions} onChange={(value) => set("religion", value)} />
        <label className="text-sm">Community
          <input className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2" value={query || form.community} onChange={(e) => { setQuery(e.target.value); set("community", e.target.value); }} placeholder="Search community" />
          {query ? <div className="mt-1 overflow-hidden rounded-2xl border border-line bg-white">{matches.map((name) => <button type="button" key={name} className="block w-full px-3 py-2 text-left text-sm hover:bg-cream" onClick={() => { set("community", name); setQuery(""); }}>{name}</button>)}</div> : null}
        </label>
        <Select label="Mother tongue" value={form.mother_tongue} options={motherTongues} onChange={(value) => set("mother_tongue", value)} />
        <Select label="Diet" value={form.diet} options={diets} onChange={(value) => set("diet", value)} />
        <Select label="Marital status" value={form.marital_status} options={maritalStatuses} onChange={(value) => set("marital_status", value)} />
        <Field label="City" value={form.city} onChange={(value) => set("city", value)} />
        <Select label="State" value={form.state} options={states} onChange={(value) => set("state", value)} />
        <Select label="Education" value={form.education_level} options={educationLevels} onChange={(value) => set("education_level", value)} />
        <Select label="Occupation" value={form.occupation} options={occupations} onChange={(value) => set("occupation", value)} />
        <Select label="Income" value={form.monthly_salary} options={salaryRanges} onChange={(value) => set("monthly_salary", value)} />
        <Field label="Height in cm" value={form.height_cm} onChange={(value) => set("height_cm", value)} />
        <label className="text-sm">About you<textarea className="mt-1 min-h-28 w-full rounded-2xl border border-line bg-white px-3 py-2" value={form.bio} onChange={(e) => set("bio", e.target.value)} /></label>
        <label className="text-sm">Photos<input required type="file" accept="image/*" multiple className="mt-1 block w-full" onChange={(e) => setPhotos([...(e.target.files ?? [])])} /></label>
      </div>
      {error ? <p className="mt-4 text-sm text-maroon">{error}</p> : null}
      <button disabled={busy} className="mt-6 rounded-full bg-maroon px-6 py-3 text-sm text-white disabled:opacity-50">{busy ? "Saving…" : "Save and continue"}</button>
    </form>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm">{label}<input required className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <label className="text-sm">{label}
      <select className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
