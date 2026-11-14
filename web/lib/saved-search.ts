export type SavedSearch = {
  gender?: string;
  age_min?: string;
  age_max?: string;
  religion?: string;
  mother_tongue?: string;
  community?: string;
};

const key = "mangalam_search";

export function readSavedSearch(): SavedSearch {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(key) || "{}") as SavedSearch;
  } catch {
    return {};
  }
}

export function writeSavedSearch(patch: SavedSearch) {
  sessionStorage.setItem(key, JSON.stringify({ ...readSavedSearch(), ...patch }));
}

export function replaceSavedSearch(value: SavedSearch) {
  sessionStorage.setItem(key, JSON.stringify(value));
}
