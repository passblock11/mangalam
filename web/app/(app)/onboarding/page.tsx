"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { CommunityField } from "@/components/community-field";
import { PhotoPicker } from "@/components/photo-picker";
import { t, tValue, useLocale } from "@/lib/i18n";
import {
  diets,
  educationLevels,
  genders,
  heightLabel,
  heightOptionsCm,
  isAtLeastAge,
  maritalStatuses,
  maxDateOfBirth,
  minDateOfBirth,
  MIN_PROFILE_AGE,
  motherTongues,
  occupations,
  profileForOptions,
  religions,
  salaryRanges,
  states,
} from "@/lib/options";

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-maroon";

export default function OnboardingPage() {
  useLocale();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
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

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="mx-auto w-full max-w-xl"
      onSubmit={async (event) => {
        event.preventDefault();
        if (photos.length === 0) {
          setError(t("Add at least one photo."));
          return;
        }
        if (!isAtLeastAge(form.date_of_birth)) {
          setError(t(`You must be at least ${MIN_PROFILE_AGE} years old.`));
          return;
        }
        const phone = form.phone.replace(/\D/g, "");
        if (phone && phone.length !== 10) {
          setError(t("Enter a 10-digit mobile number."));
          return;
        }
        setBusy(true);
        setError("");
        try {
          await api("/v1/me", {
            method: "PATCH",
            body: {
              ...form,
              phone: phone ? `+91${phone}` : form.phone,
              height_cm: Number(form.height_cm),
              country: "India",
              photo_urls: photos,
              preferences: { membership_pending: true },
            },
          });
          router.replace("/membership");
        } catch (err) {
          setError(err instanceof Error ? err.message : t("Could not save your profile."));
          setBusy(false);
        }
      }}
    >
      <p className="text-[11px] font-semibold tracking-[0.16em] text-gold uppercase">{t("Registration")}</p>
      <h1 className="display mt-1 text-3xl leading-tight sm:text-4xl">{t("Tell us about you")}</h1>
      <p className="mt-2 text-sm text-muted">{t("Same details as the Mangalam app. You must be 20 or older.")}</p>

      <div className="mt-6 grid gap-3.5 sm:grid-cols-2">
        <Select label="Profile for" value={form.profile_for} options={profileForOptions} onChange={(value) => set("profile_for", value)} />
        <Field label="Name" value={form.display_name} onChange={(value) => set("display_name", value)} required />
        <Select label="Gender" value={form.gender} options={genders.map((item) => item.value)} onChange={(value) => set("gender", value)} />
        <label className="block text-sm font-medium">
          {t("Date of birth")}
          <input
            required
            type="date"
            className={field}
            value={form.date_of_birth}
            min={minDateOfBirth()}
            max={maxDateOfBirth()}
            onChange={(e) => set("date_of_birth", e.target.value)}
          />
        </label>
        <Field label="Phone" value={form.phone} onChange={(value) => set("phone", value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" />
        <Select label="Religion" value={form.religion} options={religions} onChange={(value) => set("religion", value)} />
        <div className="sm:col-span-2">
          <CommunityField value={form.community} onChange={(value) => set("community", value)} />
        </div>
        <Select label="Mother tongue" value={form.mother_tongue} options={motherTongues} onChange={(value) => set("mother_tongue", value)} />
        <Select label="Diet" value={form.diet} options={diets} onChange={(value) => set("diet", value)} />
        <Select label="Marital status" value={form.marital_status} options={maritalStatuses} onChange={(value) => set("marital_status", value)} />
        <Field label="City" value={form.city} onChange={(value) => set("city", value)} required />
        <Select label="State" value={form.state} options={states} onChange={(value) => set("state", value)} />
        <Select label="Education" value={form.education_level} options={educationLevels} onChange={(value) => set("education_level", value)} />
        <Select label="Occupation" value={form.occupation} options={occupations} onChange={(value) => set("occupation", value)} />
        <Select label="Income" value={form.monthly_salary} options={salaryRanges} onChange={(value) => set("monthly_salary", value)} />
        <label className="block text-sm font-medium">
          {t("Height")}
          <select className={field} value={form.height_cm} onChange={(e) => set("height_cm", e.target.value)}>
            {heightOptionsCm.map((cm) => (
              <option key={cm} value={cm}>{heightLabel(cm)}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium sm:col-span-2">
          {t("About you")}
          <textarea className={`${field} min-h-24`} value={form.bio} onChange={(e) => set("bio", e.target.value)} />
        </label>
        <div className="text-sm font-medium sm:col-span-2">
          {t("Photos")}
          <div className="mt-2"><PhotoPicker urls={photos} onChange={setPhotos} /></div>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-maroon">{error}</p> : null}
      <button disabled={busy} className="mt-6 w-full rounded-xl bg-maroon px-6 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">
        {busy ? t("Saving…") : t("Save and continue")}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block text-sm font-medium">
      {t(label)}
      <input required={required} inputMode={inputMode} className={field} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {t(label)}
      <select className={field} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{tValue(option)}</option>
        ))}
      </select>
    </label>
  );
}
