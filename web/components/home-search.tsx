"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motherTongues, religions } from "@/lib/options";
import { replaceSavedSearch } from "@/lib/saved-search";

const ages = Array.from({ length: 30 }, (_, i) => String(18 + i));

export function HomeSearch({ tone = "card" }: { tone?: "card" | "overlay" }) {
  const router = useRouter();
  const [lookingFor, setLookingFor] = useState("female");
  const [ageMin, setAgeMin] = useState("22");
  const [ageMax, setAgeMax] = useState("27");
  const [religion, setReligion] = useState("");
  const [tongue, setTongue] = useState("");
  const overlay = tone === "overlay";
  const label = overlay ? "block text-sm font-medium text-white" : "block text-sm text-[#555]";
  const field = overlay
    ? "mt-1.5 h-12 w-full rounded-md border-0 bg-white px-3 text-[15px] text-[#222] shadow-sm outline-none"
    : "mt-1.5 h-12 w-full rounded-lg border border-[#d9dce3] bg-white px-3 text-[15px] outline-none";

  return (
    <form
      id="search"
      className={overlay ? "text-left" : "rounded-2xl bg-white p-5 shadow-[0_16px_50px_rgba(17,24,39,0.12)] md:p-6"}
      onSubmit={(event) => {
        event.preventDefault();
        replaceSavedSearch({
          gender: lookingFor,
          age_min: ageMin,
          age_max: ageMax,
          religion,
          mother_tongue: tongue,
        });
        router.push("/login");
      }}
    >
      <div className="grid gap-x-4 gap-y-3 md:grid-cols-2">
        <label className={label}>
          I&apos;m looking for a
          <select className={field} value={lookingFor} onChange={(e) => setLookingFor(e.target.value)}>
            <option value="female">Woman</option>
            <option value="male">Man</option>
          </select>
        </label>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <label className={label}>
            aged
            <select className={field} value={ageMin} onChange={(e) => setAgeMin(e.target.value)}>
              {ages.map((age) => <option key={age}>{age}</option>)}
            </select>
          </label>
          <span className={`pb-3 text-sm ${overlay ? "text-white" : "text-muted"}`}>to</span>
          <label className={label}>
            <span className="sr-only">to</span>
            <select className={field} aria-label="Maximum age" value={ageMax} onChange={(e) => setAgeMax(e.target.value)}>
              {ages.map((age) => <option key={age}>{age}</option>)}
            </select>
          </label>
        </div>
        <label className={label}>
          of religion
          <select className={field} value={religion} onChange={(e) => setReligion(e.target.value)}>
            <option value="">Select</option>
            {religions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className={label}>
          and mother tongue
          <select className={field} value={tongue} onChange={(e) => setTongue(e.target.value)}>
            <option value="">Select</option>
            {motherTongues.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <button className="mt-4 h-12 w-full rounded-md bg-maroon text-base font-medium text-white hover:bg-maroon-deep">
        Let&apos;s Begin
      </button>
    </form>
  );
}
