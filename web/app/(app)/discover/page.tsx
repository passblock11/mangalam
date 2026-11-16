"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Icon } from "@/components/icons";
import { t, tf, tValue, useLocale } from "@/lib/i18n";
import { ageOf, type Profile } from "@/lib/profile";
import { diets, educationLevels, mangalDoshOptions, maritalStatuses, motherTongues, occupations, religions, salaryRanges, states } from "@/lib/options";

export default function DiscoverPage() {
  useLocale();
  const [tab, setTab] = useState<"all" | "shortlist">("all");
  const [items, setItems] = useState<Profile[]>([]);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    age_min: "", age_max: "", height_min: "", height_max: "", religion: "", mother_tongue: "", community: "",
    state: "", city: "", diet: "", marital_status: "", education_level: "", occupation: "", monthly_salary: "", mangal_dosh: "", verified: false,
  });
  const filtersOn = Object.values(filters).some((value) => value !== "" && value !== false);

  useEffect(() => {
    const raw = sessionStorage.getItem("mangalam_search");
    if (!raw) return;
    sessionStorage.removeItem("mangalam_search");
    try {
      const saved = JSON.parse(raw) as { age_min?: string; age_max?: string; religion?: string; mother_tongue?: string; community?: string };
      setFilters((current) => ({
        ...current,
        age_min: saved.age_min || "",
        age_max: saved.age_max || "",
        religion: saved.religion || "",
        mother_tongue: saved.mother_tongue || "",
        community: saved.community || "",
      }));
    } catch {
      /* ignore a bad saved search */
    }
  }, []);

  useEffect(() => {
    let stop = false;
    setError("");
    api<{ items?: Profile[] }>("/v1/matches", {
      query: {
        tab,
        age_min: filters.age_min,
        age_max: filters.age_max,
        religion: filters.religion,
        mother_tongue: filters.mother_tongue,
        community: filters.community,
        state: filters.state,
        city: filters.city,
        height_min: filters.height_min,
        height_max: filters.height_max,
        diet: filters.diet,
        marital_status: filters.marital_status,
        education_level: filters.education_level,
        occupation: filters.occupation,
        monthly_salary: filters.monthly_salary,
        mangal_dosh: filters.mangal_dosh,
        verified: filters.verified ? "1" : "",
      },
    })
      .then((data) => {
        if (!stop) setItems(data.items ?? []);
      })
      .catch((err: Error) => {
        if (!stop) setError(err.message);
      });
    return () => {
      stop = true;
    };
  }, [tab, filters]);

  return (
    <div>
      <div className="flex items-end border-b border-[#e8ddcf]">
        {(["all", "shortlist"] as const).map((value) => (
          <button key={value} className={`px-4 py-3 text-sm font-semibold ${tab === value ? "border-b-2 border-maroon text-maroon" : "text-muted"}`} onClick={() => setTab(value)}>
            {value === "all" ? t("Discover") : t("Shortlisted")}
          </button>
        ))}
        <button type="button" className={`ml-auto grid h-11 w-11 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 shadow-none outline-none ${filtersOn ? "text-maroon" : "text-ink"}`} aria-label={t("Filters")} onClick={() => setFiltersOpen(true)}>
          <Icon name="settings" className="h-6 w-6" />
        </button>
      </div>
      {error ? <p className="mt-8 text-center text-sm text-maroon">{error}</p> : null}
      {items.length === 0 && !error ? (
        <div className="px-6 py-16 text-center">
          <p className="text-lg font-semibold">{filtersOn ? (tab === "shortlist" ? t("No shortlisted profiles match these filters.") : t("No profiles match these filters")) : (tab === "shortlist" ? t("Nothing shortlisted yet") : t("No new profiles nearby"))}</p>
          <p className="mt-2 text-sm leading-6 text-muted">{filtersOn ? t("Widen a range or clear the filters to see more profiles.") : (tab === "shortlist" ? t("People you like show up here. When they like you back, they move to Matches.") : t("Try adjusting your preferences or check back later for new profiles."))}</p>
          {filtersOn ? <button className="mt-4 rounded-xl bg-maroon px-4 py-2 text-sm text-white" onClick={() => setFilters({ age_min: "", age_max: "", height_min: "", height_max: "", religion: "", mother_tongue: "", community: "", state: "", city: "", diet: "", marital_status: "", education_level: "", occupation: "", monthly_salary: "", mangal_dosh: "", verified: false })}>{t("Clear filters")}</button> : null}
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          {items.map((person) => <DiscoverCard key={person.id} person={person} />)}
        </div>
      )}
      {filtersOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setFiltersOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-t-3xl bg-white p-5" onClick={(event) => event.stopPropagation()}>
            <p className="text-xl font-extrabold">{t("Filters")}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <input className="rounded-xl border border-line px-3 py-2 text-sm" placeholder={t("From")} value={filters.age_min} onChange={(e) => setFilters({ ...filters, age_min: e.target.value })} />
              <input className="rounded-xl border border-line px-3 py-2 text-sm" placeholder={t("To")} value={filters.age_max} onChange={(e) => setFilters({ ...filters, age_max: e.target.value })} />
              <FilterSelect label={`${t("Any")} ${t("Religion")}`} value={filters.religion} options={religions} onChange={(religion) => setFilters({ ...filters, religion })} />
              <FilterSelect label={t("Any")} value={filters.mother_tongue} options={motherTongues} onChange={(mother_tongue) => setFilters({ ...filters, mother_tongue })} />
              <input className="rounded-xl border border-line px-3 py-2 text-sm" placeholder={t("Community")} value={filters.community} onChange={(e) => setFilters({ ...filters, community: e.target.value })} />
              <FilterSelect label={t("Any")} value={filters.state} options={states} onChange={(state) => setFilters({ ...filters, state })} />
              <input className="rounded-xl border border-line px-3 py-2 text-sm" placeholder={t("City")} value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} />
              <input className="rounded-xl border border-line px-3 py-2 text-sm" placeholder={t("Height")} value={filters.height_min} onChange={(e) => setFilters({ ...filters, height_min: e.target.value })} />
              <FilterSelect label={t("Diet")} value={filters.diet} options={diets} onChange={(diet) => setFilters({ ...filters, diet })} />
              <FilterSelect label={t("Marital status")} value={filters.marital_status} options={maritalStatuses} onChange={(marital_status) => setFilters({ ...filters, marital_status })} />
              <FilterSelect label={t("Education")} value={filters.education_level} options={educationLevels} onChange={(education_level) => setFilters({ ...filters, education_level })} />
              <FilterSelect label={t("Occupation")} value={filters.occupation} options={occupations} onChange={(occupation) => setFilters({ ...filters, occupation })} />
              <FilterSelect label={t("Monthly salary")} value={filters.monthly_salary} options={salaryRanges} onChange={(monthly_salary) => setFilters({ ...filters, monthly_salary })} />
              <FilterSelect label={t("Mangal dosh")} value={filters.mangal_dosh} options={mangalDoshOptions} onChange={(mangal_dosh) => setFilters({ ...filters, mangal_dosh })} />
              <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={filters.verified} onChange={(e) => setFilters({ ...filters, verified: e.target.checked })} /> {t("Verified only")}</label>
            </div>
            <button className="mt-4 h-11 w-full rounded-xl bg-maroon text-sm font-semibold text-white" onClick={() => setFiltersOpen(false)}>{t("Apply")}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DiscoverCard({ person }: { person: Profile }) {
  const age = ageOf(person.date_of_birth, person.age);
  const photo = person.photo_urls?.[0];
  const place = [person.community, [person.city, person.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  return (
    <article className="overflow-hidden rounded-[22px] border border-[#e8ddcf] bg-white shadow-[0_4px_14px_rgba(183,28,28,0.06)]">
      <Link href={`/people/${person.id}`} className="relative block aspect-[4/3.4] bg-[#f3e9df]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className={`h-full w-full object-cover ${person.photos_locked ? "scale-110 blur-xl" : ""}`} />
        ) : null}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pt-8 pb-3.5 text-white">
          <span className="flex items-end justify-between gap-3">
            <span className="text-[22px] font-extrabold">{person.display_name || t("Member")}</span>
            {age ? <span className="text-sm font-semibold">{tf("{n} yrs", { n: String(age) })}</span> : null}
          </span>
          {place ? <span className="mt-1 block text-[13px]">{place}</span> : null}
        </span>
      </Link>
      <div className="flex flex-wrap gap-1.5 px-3.5 pt-3">
        {person.diet ? <span className="rounded-full bg-maroon/10 px-2.5 py-1 text-xs font-semibold text-maroon">{tValue(person.diet)}</span> : null}
        {person.mother_tongue ? <span className="rounded-full bg-maroon/10 px-2.5 py-1 text-xs font-semibold text-maroon">{tValue(person.mother_tongue)}</span> : null}
      </div>
      <div className="flex items-center px-3 pt-2 pb-3">
        <button
          className="grid h-14 w-14 place-items-center rounded-full border border-maroon text-maroon"
          aria-label={t("Like")}
          onClick={() => api("/v1/interactions", { method: "POST", body: { to_profile_id: person.id, action: "like" } }).catch(() => undefined)}
        >
          <Icon name="heart" className="h-5 w-5" />
        </button>
        <Link href={`/people/${person.id}`} className="ml-auto px-3 py-2 text-sm font-semibold text-maroon">{t("View profile")}</Link>
      </div>
    </article>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <select className="rounded-2xl border border-line bg-white px-3 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{t(label)}</option>
      {options.map((option) => <option key={option} value={option}>{tValue(option)}</option>)}
    </select>
  );
}
