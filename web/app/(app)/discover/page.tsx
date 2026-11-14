"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PersonCard } from "@/components/person-card";
import type { Profile } from "@/lib/profile";
import { diets, educationLevels, mangalDoshOptions, maritalStatuses, motherTongues, occupations, religions, salaryRanges, states } from "@/lib/options";

export default function DiscoverPage() {
  const [tab, setTab] = useState<"all" | "shortlist">("all");
  const [items, setItems] = useState<Profile[]>([]);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    age_min: "", age_max: "", height_min: "", height_max: "", religion: "", mother_tongue: "", community: "",
    state: "", city: "", diet: "", marital_status: "", education_level: "", occupation: "", monthly_salary: "", mangal_dosh: "", verified: false,
  });

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.16em] text-gold uppercase">Discover</p>
          <h1 className="text-3xl font-semibold">{tab === "all" ? "Matches for you" : "Shortlisted"}</h1>
        </div>
        <div className="flex rounded-full bg-white p-1 text-sm">
          {(["all", "shortlist"] as const).map((value) => (
            <button key={value} className={`rounded-full px-4 py-2 ${tab === value ? "bg-maroon text-white" : "text-muted"}`} onClick={() => setTab(value)}>
              {value === "all" ? "Discover" : "Shortlisted"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-3 lg:grid-cols-6">
        <input className="rounded-2xl border border-line px-3 py-2 text-sm" placeholder="Age from" value={filters.age_min} onChange={(e) => setFilters({ ...filters, age_min: e.target.value })} />
        <input className="rounded-2xl border border-line px-3 py-2 text-sm" placeholder="Age to" value={filters.age_max} onChange={(e) => setFilters({ ...filters, age_max: e.target.value })} />
        <select className="rounded-2xl border border-line px-3 py-2 text-sm" value={filters.religion} onChange={(e) => setFilters({ ...filters, religion: e.target.value })}>
          <option value="">Any religion</option>
          {religions.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className="rounded-2xl border border-line px-3 py-2 text-sm" value={filters.mother_tongue} onChange={(e) => setFilters({ ...filters, mother_tongue: e.target.value })}>
          <option value="">Any mother tongue</option>
          {motherTongues.map((item) => <option key={item}>{item}</option>)}
        </select>
        <input className="rounded-2xl border border-line px-3 py-2 text-sm" placeholder="Community" value={filters.community} onChange={(e) => setFilters({ ...filters, community: e.target.value })} />
        <select className="rounded-2xl border border-line px-3 py-2 text-sm" value={filters.state} onChange={(e) => setFilters({ ...filters, state: e.target.value })}>
          <option value="">Any state</option>
          {states.map((item) => <option key={item}>{item}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={filters.verified} onChange={(e) => setFilters({ ...filters, verified: e.target.checked })} />
          Verified only
        </label>
        <input className="rounded-2xl border border-line px-3 py-2 text-sm" placeholder="City" value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} />
        <input className="rounded-2xl border border-line px-3 py-2 text-sm" placeholder="Height from cm" value={filters.height_min} onChange={(e) => setFilters({ ...filters, height_min: e.target.value })} />
        <input className="rounded-2xl border border-line px-3 py-2 text-sm" placeholder="Height to cm" value={filters.height_max} onChange={(e) => setFilters({ ...filters, height_max: e.target.value })} />
        <FilterSelect label="Any diet" value={filters.diet} options={diets} onChange={(diet) => setFilters({ ...filters, diet })} />
        <FilterSelect label="Any marital status" value={filters.marital_status} options={maritalStatuses} onChange={(marital_status) => setFilters({ ...filters, marital_status })} />
        <FilterSelect label="Any education" value={filters.education_level} options={educationLevels} onChange={(education_level) => setFilters({ ...filters, education_level })} />
        <FilterSelect label="Any occupation" value={filters.occupation} options={occupations} onChange={(occupation) => setFilters({ ...filters, occupation })} />
        <FilterSelect label="Any salary" value={filters.monthly_salary} options={salaryRanges} onChange={(monthly_salary) => setFilters({ ...filters, monthly_salary })} />
        <FilterSelect label="Any mangal dosh" value={filters.mangal_dosh} options={mangalDoshOptions} onChange={(mangal_dosh) => setFilters({ ...filters, mangal_dosh })} />
      </div>
      {error ? <p className="mt-4 text-sm text-maroon">{error}</p> : null}
      {items.length === 0 && !error ? <p className="mt-10 text-muted">{tab === "all" ? "No other profiles match these filters yet." : "People you like appear here."}</p> : null}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map((person) => <PersonCard key={person.id} person={person} />)}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <select className="rounded-2xl border border-line px-3 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{label}</option>
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  );
}
