"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PersonCard } from "@/components/person-card";
import type { Profile } from "@/lib/profile";

const tabs = [
  ["liked", "Likes"],
  ["mutual", "Matches"],
  ["views", "Views"],
  ["contacts", "Contacts"],
] as const;

type Item = { profile?: Profile };

export default function ConnectionsPage() {
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("liked");
  const [items, setItems] = useState<Profile[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let stop = false;
    api<{ items?: Array<Profile | Item> }>("/v1/likes", { query: { tab } })
      .then((data) => {
        if (stop) return;
        setItems(
          (data.items ?? []).map((item) => ("profile" in item && item.profile ? item.profile : (item as Profile))),
        );
      })
      .catch((err: Error) => {
        if (!stop) setError(err.message);
      });
    return () => {
      stop = true;
    };
  }, [tab]);

  return (
    <div>
      <p className="text-xs tracking-[0.16em] text-gold uppercase">Connections</p>
      <h1 className="display text-5xl">People connected to you</h1>
      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map(([value, label]) => (
          <button key={value} className={`rounded-full px-4 py-2 text-sm ${tab === value ? "bg-maroon text-white" : "bg-white text-muted"}`} onClick={() => setTab(value)}>
            {label}
          </button>
        ))}
      </div>
      {error ? <p className="mt-4 text-sm text-maroon">{error}</p> : null}
      {items.length === 0 && !error ? <p className="mt-10 text-muted">Nothing here yet.</p> : null}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map((person) => person.id ? <PersonCard key={person.id} person={person} /> : null)}
      </div>
    </div>
  );
}
