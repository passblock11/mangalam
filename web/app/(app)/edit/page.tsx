"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { communities } from "@/lib/communities";
import { diets, educationLevels, genders, languages, mangalDoshOptions, maritalStatuses, motherTongues, occupations, profileForOptions, religions, salaryRanges, states } from "@/lib/options";
import type { Profile } from "@/lib/profile";
import { uploadPhoto } from "@/lib/upload";

type Form = {
  display_name: string;
  gender: string;
  date_of_birth: string;
  profile_for: string;
  phone: string;
  whatsapp_number: string;
  phone_visible: boolean;
  photos_visible: boolean;
  city: string;
  state: string;
  religion: string;
  community: string;
  mother_tongue: string;
  diet: string;
  marital_status: string;
  education_level: string;
  occupation: string;
  monthly_salary: string;
  height_cm: string;
  mangal_dosh: string;
  birth_time: string;
  birth_place: string;
  bio: string;
  app_language: string;
  age_min: string;
  age_max: string;
  partner_location: string;
  partner_height: string;
  partner_diet: string;
  partner_marital: string;
  partner_tongue: string;
  partner_mangal: string;
  partner_occupation: string;
  partner_salary: string;
  partner_education: string;
};

const empty: Form = {
  display_name: "", gender: "male", date_of_birth: "", profile_for: "Self", phone: "", whatsapp_number: "",
  phone_visible: false, photos_visible: true, city: "", state: "", religion: "", community: "", mother_tongue: "",
  diet: "", marital_status: "", education_level: "", occupation: "", monthly_salary: "", height_cm: "",
  mangal_dosh: "", birth_time: "", birth_place: "", bio: "", app_language: "en", age_min: "", age_max: "",
  partner_location: "", partner_height: "", partner_diet: "", partner_marital: "", partner_tongue: "",
  partner_mangal: "", partner_occupation: "", partner_salary: "", partner_education: "",
};

export default function EditProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<Form>(empty);
  const [photos, setPhotos] = useState<string[]>([]);
  const [communityQuery, setCommunityQuery] = useState("");
  const [communityOpen, setCommunityOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const suggestions = useMemo(
    () => communities.filter((name) => name.toLowerCase().includes(communityQuery.toLowerCase())).slice(0, 8),
    [communityQuery],
  );

  useEffect(() => {
    api<{ profile: Profile | null }>("/v1/me").then(({ profile }) => {
      if (!profile) return;
      const partner = profile.partner_preferences ?? {};
      const phone = (profile.phone ?? "").replace(/^\+91/, "");
      setPhotos(profile.photo_urls ?? []);
      setCommunityQuery(profile.community ?? "");
      setForm({
        ...empty,
        display_name: profile.display_name ?? "",
        gender: profile.gender ?? "male",
        date_of_birth: profile.date_of_birth ?? "",
        profile_for: profile.profile_for ?? "Self",
        phone,
        whatsapp_number: profile.whatsapp_number ?? "",
        phone_visible: profile.phone_visible === true,
        photos_visible: profile.preferences?.photos_visible !== false,
        city: profile.city ?? "",
        state: profile.state ?? "",
        religion: profile.religion ?? "",
        community: profile.community ?? "",
        mother_tongue: profile.mother_tongue ?? "",
        diet: profile.diet ?? "",
        marital_status: profile.marital_status ?? "",
        education_level: profile.education_level ?? "",
        occupation: profile.occupation ?? "",
        monthly_salary: profile.monthly_salary ?? "",
        height_cm: profile.height_cm ? String(profile.height_cm) : "",
        mangal_dosh: profile.mangal_dosh ?? "",
        birth_time: profile.birth_time ?? "",
        birth_place: profile.birth_place ?? "",
        bio: profile.bio ?? "",
        app_language: profile.app_language || "en",
        age_min: partner.age_min != null ? String(partner.age_min) : "",
        age_max: partner.age_max != null ? String(partner.age_max) : "",
        partner_location: String(partner.location ?? partner.city ?? ""),
        partner_height: String(partner.height ?? ""),
        partner_diet: String(partner.diet ?? ""),
        partner_marital: String(partner.marital_status ?? ""),
        partner_tongue: String(partner.mother_tongue ?? ""),
        partner_mangal: String(partner.mangal_dosh ?? ""),
        partner_occupation: String(partner.occupation ?? ""),
        partner_salary: String(partner.monthly_salary ?? ""),
        partner_education: String(partner.education_level ?? ""),
      });
    }).catch((err: Error) => setError(err.message));
  }, []);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="mx-auto max-w-3xl"
      onSubmit={async (event) => {
        event.preventDefault();
        const phone = form.phone.replace(/\D/g, "");
        if (phone.length !== 10) {
          setError("Enter a 10-digit mobile number.");
          return;
        }
        const height = Number(form.height_cm);
        if (!Number.isInteger(height) || height < 100 || height > 250) {
          setError("Height must be between 100 and 250 cm.");
          return;
        }
        setBusy(true);
        setError("");
        try {
          const partner: Record<string, string | number> = {};
          if (form.age_min) partner.age_min = Number(form.age_min);
          if (form.age_max) partner.age_max = Number(form.age_max);
          const put = (key: string, value: string) => {
            if (value.trim()) partner[key] = value.trim();
          };
          put("location", form.partner_location);
          put("height", form.partner_height);
          put("diet", form.partner_diet);
          put("marital_status", form.partner_marital);
          put("mother_tongue", form.partner_tongue);
          put("mangal_dosh", form.partner_mangal);
          put("occupation", form.partner_occupation);
          put("monthly_salary", form.partner_salary);
          put("education_level", form.partner_education);
          await api("/v1/me", {
            method: "PATCH",
            body: {
              display_name: form.display_name.trim(),
              gender: form.gender,
              date_of_birth: form.date_of_birth,
              profile_for: form.profile_for,
              phone: `+91${phone}`,
              whatsapp_number: form.whatsapp_number.trim(),
              phone_visible: form.phone_visible,
              preferences: { photos_visible: form.photos_visible },
              city: form.city.trim(),
              state: form.state,
              religion: form.religion,
              community: form.community.trim(),
              mother_tongue: form.mother_tongue,
              diet: form.diet,
              marital_status: form.marital_status,
              education_level: form.education_level,
              occupation: form.occupation,
              monthly_salary: form.monthly_salary,
              height_cm: height,
              mangal_dosh: form.mangal_dosh,
              birth_time: form.birth_time.trim(),
              birth_place: form.birth_place.trim(),
              bio: form.bio.trim(),
              app_language: form.app_language,
              photo_urls: photos,
              partner_preferences: partner,
            },
          });
          router.push("/profile");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1 className="text-3xl font-semibold">Edit profile</h1>
      <p className="mt-2 text-sm text-muted">The same details as the phone app. The language setting updates the app. This website stays in English.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Name"><input className={input} value={form.display_name} onChange={(e) => set("display_name", e.target.value)} required /></Field>
        <Field label="Profile for"><Select value={form.profile_for} options={profileForOptions} onChange={(value) => set("profile_for", value)} /></Field>
        <Field label="Gender"><Select value={form.gender} options={genders.map((item) => item.value)} onChange={(value) => set("gender", value)} /></Field>
        <Field label="Date of birth"><input className={input} type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} required /></Field>
        <Field label="Mobile number"><input className={input} inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="WhatsApp"><input className={input} value={form.whatsapp_number} onChange={(e) => set("whatsapp_number", e.target.value)} /></Field>
        <Field label="City"><input className={input} value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
        <Field label="State"><Select value={form.state} options={states} onChange={(value) => set("state", value)} allowEmpty /></Field>
        <Field label="Religion"><Select value={form.religion} options={religions} onChange={(value) => set("religion", value)} /></Field>
        <Field label="Community">
          <input className={input} value={communityQuery} onFocus={() => setCommunityOpen(true)} onBlur={() => window.setTimeout(() => setCommunityOpen(false), 150)} onChange={(e) => { setCommunityQuery(e.target.value); set("community", e.target.value); setCommunityOpen(true); }} />
          {communityOpen && suggestions.length ? (
            <div className="mt-1 max-h-36 overflow-auto rounded-xl border border-line bg-white">
              {suggestions.map((name) => (
                <button type="button" key={name} className="block w-full px-3 py-2 text-left text-sm hover:bg-[#f7f8fa]" onClick={() => { set("community", name); setCommunityQuery(name); }}>{name}</button>
              ))}
            </div>
          ) : null}
        </Field>
        <Field label="Mother tongue"><Select value={form.mother_tongue} options={motherTongues} onChange={(value) => set("mother_tongue", value)} /></Field>
        <Field label="Diet"><Select value={form.diet} options={diets} onChange={(value) => set("diet", value)} /></Field>
        <Field label="Marital status"><Select value={form.marital_status} options={maritalStatuses} onChange={(value) => set("marital_status", value)} /></Field>
        <Field label="Education"><Select value={form.education_level} options={educationLevels} onChange={(value) => set("education_level", value)} allowEmpty /></Field>
        <Field label="Occupation"><Select value={form.occupation} options={occupations} onChange={(value) => set("occupation", value)} allowEmpty /></Field>
        <Field label="Monthly salary"><Select value={form.monthly_salary} options={salaryRanges} onChange={(value) => set("monthly_salary", value)} allowEmpty /></Field>
        <Field label="Height (cm)"><input className={input} value={form.height_cm} onChange={(e) => set("height_cm", e.target.value)} /></Field>
        <Field label="Mangal dosh"><Select value={form.mangal_dosh} options={mangalDoshOptions} onChange={(value) => set("mangal_dosh", value)} allowEmpty /></Field>
        <Field label="Birth time"><input className={input} value={form.birth_time} onChange={(e) => set("birth_time", e.target.value)} placeholder="HH:MM" /></Field>
        <Field label="Birth place"><input className={input} value={form.birth_place} onChange={(e) => set("birth_place", e.target.value)} /></Field>
        <Field label="App language">
          <select className={input} value={form.app_language} onChange={(e) => set("app_language", e.target.value)}>
            {languages.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </Field>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.phone_visible} onChange={(e) => set("phone_visible", e.target.checked)} /> Allow verified members to request my phone number</label>
      <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.photos_visible} onChange={(e) => set("photos_visible", e.target.checked)} /> Show my photos to other members</label>
      <Field label="About you"><textarea className={`${input} min-h-28`} value={form.bio} onChange={(e) => set("bio", e.target.value)} /></Field>
      <h2 className="mt-8 text-xl font-semibold">Photos</h2>
      <div className="mt-3 flex flex-wrap gap-3">
        {photos.map((url) => (
          <div key={url} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-28 w-24 rounded-xl object-cover" />
            <button type="button" className="absolute top-1 right-1 rounded-full bg-white px-2 text-xs" onClick={() => setPhotos(photos.filter((item) => item !== url))}>Remove</button>
          </div>
        ))}
      </div>
      <input className="mt-3 text-sm" type="file" accept="image/*" onChange={async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || photos.length >= 6) return;
        try {
          const url = await uploadPhoto(file, "profile-photos");
          setPhotos((current) => [...current, url]);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not upload the photo.");
        }
      }} />
      <h2 className="mt-8 text-xl font-semibold">Partner preference</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Field label="Age from"><input className={input} value={form.age_min} onChange={(e) => set("age_min", e.target.value)} placeholder="All Ok" /></Field>
        <Field label="Age to"><input className={input} value={form.age_max} onChange={(e) => set("age_max", e.target.value)} placeholder="All Ok" /></Field>
        <Field label="Location"><input className={input} value={form.partner_location} onChange={(e) => set("partner_location", e.target.value)} placeholder="All Ok" /></Field>
        <Field label="Height"><input className={input} value={form.partner_height} onChange={(e) => set("partner_height", e.target.value)} placeholder="All Ok" /></Field>
        <Field label="Diet"><Select value={form.partner_diet} options={diets} allowEmpty onChange={(value) => set("partner_diet", value)} /></Field>
        <Field label="Marital status"><Select value={form.partner_marital} options={maritalStatuses} allowEmpty onChange={(value) => set("partner_marital", value)} /></Field>
        <Field label="Mother tongue"><Select value={form.partner_tongue} options={motherTongues} allowEmpty onChange={(value) => set("partner_tongue", value)} /></Field>
        <Field label="Mangal dosh"><Select value={form.partner_mangal} options={mangalDoshOptions} allowEmpty onChange={(value) => set("partner_mangal", value)} /></Field>
        <Field label="Occupation"><Select value={form.partner_occupation} options={occupations} allowEmpty onChange={(value) => set("partner_occupation", value)} /></Field>
        <Field label="Education"><Select value={form.partner_education} options={educationLevels} allowEmpty onChange={(value) => set("partner_education", value)} /></Field>
        <Field label="Monthly salary"><Select value={form.partner_salary} options={salaryRanges} allowEmpty onChange={(value) => set("partner_salary", value)} /></Field>
      </div>
      {error ? <p className="mt-4 text-sm text-maroon">{error}</p> : null}
      <button disabled={busy} className="mt-6 rounded-md bg-maroon px-6 py-3 text-sm font-medium text-white disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
    </form>
  );
}

const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm">{label}{children}</label>;
}

function Select({ value, options, onChange, allowEmpty = false }: { value: string; options: string[]; onChange: (value: string) => void; allowEmpty?: boolean }) {
  return (
    <select className={input} value={value} onChange={(event) => onChange(event.target.value)}>
      {allowEmpty ? <option value="">All Ok</option> : null}
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  );
}
