import { Hono } from "hono";
import { requireAuth } from "../auth.js";
import { viewerCanSeeContact, viewerContactCosts } from "../contact-access.js";
import { presentOtherMember } from "../public-profile.js";
import { getSupabaseAdmin } from "../supabase.js";

export const matchesRouter = new Hono();

matchesRouter.use("*", requireAuth);

type DiscoverFilters = {
  ageMin: number | null;
  ageMax: number | null;
  heightMin: number | null;
  heightMax: number | null;
  state: string | null;
  city: string | null;
  religion: string | null;
  community: string | null;
  motherTongue: string | null;
  diet: string | null;
  marital: string | null;
  education: string | null;
  occupation: string | null;
  salary: string | null;
  mangal: string | null;
  verified: boolean;
};

function boundedInt(raw: string | undefined, min: number, max: number): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i < min || i > max) return null;
  return i;
}

function textQuery(raw: string | undefined, max = 80): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  return value.slice(0, max);
}

function readFilters(c: { req: { query: (name: string) => string | undefined } }): DiscoverFilters {
  let ageMin = boundedInt(c.req.query("age_min"), 18, 80);
  let ageMax = boundedInt(c.req.query("age_max"), 18, 80);
  if (ageMin != null && ageMax != null && ageMin > ageMax) {
    const swap = ageMin;
    ageMin = ageMax;
    ageMax = swap;
  }
  let heightMin = boundedInt(c.req.query("height_min"), 100, 250);
  let heightMax = boundedInt(c.req.query("height_max"), 100, 250);
  if (heightMin != null && heightMax != null && heightMin > heightMax) {
    const swap = heightMin;
    heightMin = heightMax;
    heightMax = swap;
  }
  return {
    ageMin,
    ageMax,
    heightMin,
    heightMax,
    state: textQuery(c.req.query("state")),
    city: textQuery(c.req.query("city")),
    religion: textQuery(c.req.query("religion")),
    community: textQuery(c.req.query("community")),
    motherTongue: textQuery(c.req.query("mother_tongue")),
    diet: textQuery(c.req.query("diet")),
    marital: textQuery(c.req.query("marital_status")),
    education: textQuery(c.req.query("education_level")),
    occupation: textQuery(c.req.query("occupation")),
    salary: textQuery(c.req.query("monthly_salary")),
    mangal: textQuery(c.req.query("mangal_dosh"), 40),
    verified: c.req.query("verified") === "1",
  };
}

function filtersActive(f: DiscoverFilters): boolean {
  return (
    f.ageMin != null ||
    f.ageMax != null ||
    f.heightMin != null ||
    f.heightMax != null ||
    f.verified ||
    [
      f.state,
      f.city,
      f.religion,
      f.community,
      f.motherTongue,
      f.diet,
      f.marital,
      f.education,
      f.occupation,
      f.salary,
      f.mangal,
    ].some((v) => v != null)
  );
}

function ageOf(dob: unknown): number | null {
  if (!dob) return null;
  const d = new Date(String(dob));
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}

function sameText(value: unknown, expected: string | null): boolean {
  if (expected == null) return true;
  return String(value ?? "").trim().toLowerCase() === expected.toLowerCase();
}

function containsText(value: unknown, expected: string | null): boolean {
  if (expected == null) return true;
  return String(value ?? "").trim().toLowerCase().includes(expected.toLowerCase());
}

function rowMatches(row: Record<string, unknown>, f: DiscoverFilters): boolean {
  if (!filtersActive(f)) return true;
  const age = ageOf(row.date_of_birth);
  if (f.ageMin != null && (age == null || age < f.ageMin)) return false;
  if (f.ageMax != null && (age == null || age > f.ageMax)) return false;
  const height = row.height_cm == null ? null : Number(row.height_cm);
  if (f.heightMin != null && (height == null || !Number.isFinite(height) || height < f.heightMin)) {
    return false;
  }
  if (f.heightMax != null && (height == null || !Number.isFinite(height) || height > f.heightMax)) {
    return false;
  }
  if (f.verified && row.is_verified !== true) return false;
  if (!sameText(row.state, f.state)) return false;
  if (!containsText(row.city, f.city)) return false;
  if (!sameText(row.religion, f.religion)) return false;
  if (!containsText(row.community, f.community)) return false;
  if (!sameText(row.mother_tongue, f.motherTongue)) return false;
  if (!sameText(row.diet, f.diet)) return false;
  if (!sameText(row.marital_status, f.marital)) return false;
  if (!sameText(row.education_level, f.education)) return false;
  if (!sameText(row.occupation, f.occupation)) return false;
  if (!sameText(row.monthly_salary, f.salary)) return false;
  if (!sameText(row.mangal_dosh, f.mangal)) return false;
  return true;
}

const profileFilterColumns =
  "id,display_name,date_of_birth,gender,religion,community,mother_tongue,city,state,diet,marital_status,education_level,occupation,monthly_salary,height_cm,mangal_dosh,is_verified,updated_at,photo_urls,phone,whatsapp_number,phone_visible,preferences";

/** tab=all (default) | shortlist — shortlist = profiles you marked shortlisted */
matchesRouter.get("/", async (c) => {
  const uid = c.get("userId");
  const tab = c.req.query("tab") ?? "all";
  const filters = readFilters(c);
  const sb = getSupabaseAdmin();
  const [canSeeContact, costs] = await Promise.all([
    viewerCanSeeContact(uid),
    viewerContactCosts(uid),
  ]);

  if (tab === "shortlist") {
    const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
    // One-way likes only. A like back sets both rows to mutual, and those
    // profiles leave this tab for the Matches list.
    const { data: rows, error } = await sb
      .from("interactions")
      .select("to_profile_id,updated_at,status")
      .eq("from_profile_id", uid)
      .in("status", ["shortlisted", "pending"])
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) return c.json({ error: error.message }, 500);
    const ids = (rows ?? []).map((r) => r.to_profile_id);
    if (ids.length === 0) return c.json({ items: [] });

    const { data: profs, error: pErr } = await sb
      .from("profiles")
      .select(profileFilterColumns)
      .in("id", ids);
    if (pErr) return c.json({ error: pErr.message }, 500);

    const now = new Date();
    const items = (profs ?? []).filter((r) => rowMatches(r as Record<string, unknown>, filters)).map((r) => {
      let age: number | null = null;
      if (r.date_of_birth) {
        const d = new Date(r.date_of_birth);
        age = Math.floor(
          (now.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000)
        );
      }
      return {
        ...presentOtherMember(r as Record<string, unknown>, {
          canAttemptContact: canSeeContact,
          costs,
        }),
        age,
        active_recent: r.updated_at
          ? Date.now() - new Date(r.updated_at).getTime() < 36 * 3600 * 1000
          : false,
      };
    });
    return c.json({ items });
  }

  const { data: me, error: meErr } = await sb
    .from("profiles")
    .select("id,gender,state,preferences")
    .eq("id", uid)
    .single();
  if (meErr || !me) return c.json({ error: "Profile not found" }, 404);

  const opposite =
    me.gender === "male"
      ? "female"
      : me.gender === "female"
        ? "male"
        : null;

  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);

  const { data: blockedRows } = await sb
    .from("blocks")
    .select("blocked_id,blocker_id")
    .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);

  const blocked = new Set<string>();
  for (const row of blockedRows ?? []) {
    if (row.blocker_id === uid) blocked.add(row.blocked_id);
    if (row.blocked_id === uid) blocked.add(row.blocker_id);
  }

  const { data: interacted } = await sb
    .from("interactions")
    .select("to_profile_id,from_profile_id,status")
    .or(`from_profile_id.eq.${uid},to_profile_id.eq.${uid}`);

  // Hide anyone this user has already liked or shortlisted, plus anyone
  // they passed. A like back makes the pair mutual, and those profiles
  // stay out of Discover too — they live in Shortlisted, then Matches.
  // Someone who liked you, but you have not liked yet, still appears here.
  const hidden = new Set<string>([uid]);
  for (const row of interacted ?? []) {
    if (row.from_profile_id !== uid) continue;
    if (
      row.status === "passed" ||
      row.status === "pending" ||
      row.status === "shortlisted" ||
      row.status === "mutual"
    ) {
      hidden.add(row.to_profile_id);
    }
  }

  // Soft location preference (NOT a hard filter): same-state profiles are
  // ranked first, but profiles from other states still appear. A hard
  // `eq("state", me.state)` emptied Discover whenever test/seed users lived
  // in different states — unlike other matrimonial apps that keep showing
  // profiles nationwide.
  let q = sb
    .from("profiles")
    .select(profileFilterColumns)
    .neq("id", uid)
    .not("display_name", "is", null)
    .eq("is_banned", false)
    .limit(filtersActive(filters) ? 400 : Math.min(limit * 3, 150));

  if (opposite) q = q.eq("gender", opposite);
  if (filters.verified) q = q.eq("is_verified", true);
  if (filters.state) q = q.eq("state", filters.state);
  if (filters.religion) q = q.eq("religion", filters.religion);
  if (filters.motherTongue) q = q.eq("mother_tongue", filters.motherTongue);
  if (filters.diet) q = q.eq("diet", filters.diet);
  if (filters.marital) q = q.eq("marital_status", filters.marital);
  if (filters.education) q = q.eq("education_level", filters.education);
  if (filters.occupation) q = q.eq("occupation", filters.occupation);
  if (filters.salary) q = q.eq("monthly_salary", filters.salary);
  if (filters.mangal) q = q.eq("mangal_dosh", filters.mangal);
  if (filters.city) q = q.ilike("city", `%${filters.city.replace(/[%_]/g, "")}%`);
  if (filters.community) {
    q = q.ilike("community", `%${filters.community.replace(/[%_]/g, "")}%`);
  }
  if (filters.heightMin != null) q = q.gte("height_cm", filters.heightMin);
  if (filters.heightMax != null) q = q.lte("height_cm", filters.heightMax);
  if (filters.ageMin != null) {
    const latest = new Date();
    latest.setFullYear(latest.getFullYear() - filters.ageMin);
    latest.setDate(latest.getDate() + 2);
    q = q.lte("date_of_birth", latest.toISOString().slice(0, 10));
  }
  if (filters.ageMax != null) {
    const earliest = new Date();
    earliest.setFullYear(earliest.getFullYear() - (filters.ageMax + 1));
    earliest.setDate(earliest.getDate() - 2);
    q = q.gte("date_of_birth", earliest.toISOString().slice(0, 10));
  }

  const { data: rows, error } = await q;
  if (error) return c.json({ error: error.message }, 500);

  const filtered = (rows ?? []).filter(
    (r) =>
      !blocked.has(r.id) &&
      !hidden.has(r.id) &&
      !!r.display_name &&
      rowMatches(r as Record<string, unknown>, filters)
  );

  // Rank: same state first, then recently active, then others
  const myState = (me.state ?? "").toString().toLowerCase();
  filtered.sort((a, b) => {
    const aSame = myState && (a.state ?? "").toString().toLowerCase() === myState ? 0 : 1;
    const bSame = myState && (b.state ?? "").toString().toLowerCase() === myState ? 0 : 1;
    if (aSame !== bSame) return aSame - bSame;
    const aT = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bT = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return bT - aT;
  });

  const now = new Date();
  const items = filtered.slice(0, limit).map((r) => {
    let age: number | null = null;
    if (r.date_of_birth) {
      const d = new Date(r.date_of_birth);
      age = Math.floor(
        (now.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000)
      );
    }
    return {
      ...presentOtherMember(r as Record<string, unknown>, {
        canAttemptContact: canSeeContact,
        costs,
      }),
      age,
      active_recent: r.updated_at
        ? Date.now() - new Date(r.updated_at).getTime() < 36 * 3600 * 1000
        : false,
    };
  });

  return c.json({ items });
});
