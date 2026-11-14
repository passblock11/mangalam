"use client";

import { useEffect, useState } from "react";
import { states } from "@/lib/options";

type City = { city: string; state: string; label: string };

export function CitySearch({
  label,
  value,
  onCity,
  onState,
  includeState = false,
}: {
  label: string;
  value: string;
  onCity: (city: string) => void;
  onState?: (state: string) => void;
  includeState?: boolean;
}) {
  const [text, setText] = useState(value);
  const [results, setResults] = useState<City[]>([]);

  useEffect(() => setText(value), [value]);

  useEffect(() => {
    const query = text.trim();
    if (query.length < 2 || query === value) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`);
      if (!response.ok) return;
      const data = (await response.json()) as { results?: City[] };
      setResults(data.results ?? []);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [text, value]);

  return (
    <label className="block text-sm">
      {label}
      <input className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" value={text} onChange={(event) => setText(event.target.value)} />
      {results.length ? (
        <div className="mt-1 overflow-hidden rounded-xl border border-line bg-white">
          {results.map((item) => (
            <button
              type="button"
              key={item.label}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-[#f7f8fa]"
              onClick={() => {
                const chosen = includeState && item.state ? `${item.city}, ${item.state}` : item.city;
                setText(chosen);
                onCity(chosen);
                if (item.state && onState) {
                  const match = states.find((name) => name.toLowerCase() === item.state.toLowerCase());
                  if (match) onState(match);
                }
                setResults([]);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}
