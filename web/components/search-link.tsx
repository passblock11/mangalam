"use client";

import { useRouter } from "next/navigation";
import { writeSavedSearch, type SavedSearch } from "@/lib/saved-search";

export function SearchLink({
  label,
  patch,
  className,
  href = "/login",
}: {
  label: string;
  patch: SavedSearch;
  className?: string;
  href?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        writeSavedSearch(patch);
        router.push(href);
      }}
    >
      {label}
    </button>
  );
}
