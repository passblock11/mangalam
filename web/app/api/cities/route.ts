import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ results: [] });
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", "in");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  const response = await fetch(url, {
    headers: {
      "User-Agent": "MangalamWeb/1.0 (matrimonial website; passblock.securities@gmail.com)",
      Accept: "application/json",
    },
  });
  if (!response.ok) return NextResponse.json({ results: [] });
  const rows = (await response.json()) as Array<{ display_name?: string; address?: Record<string, string> }>;
  const results = rows.flatMap((row) => {
    const address = row.address ?? {};
    const city = address.city || address.town || address.village || address.municipality || address.county || address.state_district;
    const state = address.state || address.region || "";
    if (!city) return [];
    return [{ city, state, label: row.display_name || city }];
  });
  return NextResponse.json({ results });
}
