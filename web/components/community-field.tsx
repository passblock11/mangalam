"use client";

import { useEffect, useMemo, useState } from "react";
import { communities } from "@/lib/communities";
import { t } from "@/lib/i18n";

const inputClass = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-maroon";

/** Searchable community picker — same list as the Mangalam app. */
export function CommunityField({
  value,
  onChange,
  label = "Community",
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return communities.slice(0, 12);
    return communities.filter((name) => name.toLowerCase().includes(q)).slice(0, 12);
  }, [query]);

  return (
    <label className="relative block text-sm font-medium">
      {t(label)}
      <input
        className={inputClass}
        value={query}
        required={required}
        placeholder={t("Search community")}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
      />
      {open ? (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-line bg-white shadow-lg">
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">{t("No matches")}</p>
          ) : (
            matches.map((name) => (
              <button
                type="button"
                key={name}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-cream"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery(name);
                  onChange(name);
                  setOpen(false);
                }}
              >
                {name}
              </button>
            ))
          )}
        </div>
      ) : null}
    </label>
  );
}
