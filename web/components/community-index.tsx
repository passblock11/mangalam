"use client";

import { useMemo, useState } from "react";
import { SearchLink } from "@/components/search-link";
import { communities } from "@/lib/communities";

export function CommunityIndex() {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return communities;
    return communities.filter((name) => name.toLowerCase().includes(needle));
  }, [query]);

  return (
    <div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search a community"
        className="h-12 w-full max-w-md rounded-md border border-[#d9dce3] px-4 text-sm outline-none"
      />
      <p className="mt-4 text-sm text-muted">{shown.length} communities</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {shown.map((name) => (
          <SearchLink
            key={name}
            label={name}
            patch={{ community: name }}
            className="rounded-full border border-[#e4e7ee] bg-white px-4 py-2 text-sm hover:border-maroon hover:text-maroon"
          />
        ))}
      </div>
    </div>
  );
}
