import { Hono } from "hono";
import { requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";

export const matchesRouter = new Hono();

matchesRouter.use("*", requireAuth);

/** tab=all (default) | shortlist — shortlist = profiles you marked shortlisted */
matchesRouter.get("/", async (c) => {
  const uid = c.get("userId");
  const tab = c.req.query("tab") ?? "all";
  const sb = getSupabaseAdmin();

  if (tab === "shortlist") {
    const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
    // Shortlisted tab shows everyone this user has expressed interest in:
    // explicit shortlists AND likes (pending or mutual). A like used to
    // vanish from this tab because only status=shortlisted was queried.
    const { data: rows, error } = await sb
      .from("interactions")
      .select("to_profile_id,updated_at,status")
      .eq("from_profile_id", uid)
      .in("status", ["shortlisted", "pending", "mutual"])
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) return c.json({ error: error.message }, 500);
    const ids = (rows ?? []).map((r) => r.to_profile_id);
    if (ids.length === 0) return c.json({ items: [] });

    const { data: profs, error: pErr } = await sb
      .from("profiles")
      .select(
        "id,display_name,date_of_birth,gender,community,mother_tongue,city,state,is_verified,updated_at,photo_urls"
      )
      .in("id", ids);
    if (pErr) return c.json({ error: pErr.message }, 500);

    const now = new Date();
    const items = (profs ?? []).map((r) => {
      let age: number | null = null;
      if (r.date_of_birth) {
        const d = new Date(r.date_of_birth);
        age = Math.floor(
          (now.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000)
        );
      }
      return {
        id: r.id,
        display_name: r.display_name,
        age,
        gender: r.gender,
        community: r.community,
        mother_tongue: r.mother_tongue,
        city: r.city,
        state: r.state,
        is_verified: r.is_verified,
        photo_urls: r.photo_urls ?? [],
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

  // Only hide profiles the current user has explicitly PASSED on (so they
  // don't keep re-seeing people they rejected). Likes, shortlists, mutual
  // matches, and incoming likes from others stay visible in Discover —
  // matching the behaviour of other matrimonial apps, where a profile
  // remains discoverable even after you've liked/matched.
  // (interaction_status enum: pending | mutual | passed | shortlisted)
  const passed = new Set<string>([uid]);
  for (const row of interacted ?? []) {
    if (row.from_profile_id === uid && row.status === "passed") {
      passed.add(row.to_profile_id);
    }
  }

  // Soft location preference (NOT a hard filter): same-state profiles are
  // ranked first, but profiles from other states still appear. A hard
  // `eq("state", me.state)` emptied Discover whenever test/seed users lived
  // in different states — unlike other matrimonial apps that keep showing
  // profiles nationwide.
  let q = sb
    .from("profiles")
    .select(
      "id,display_name,date_of_birth,gender,community,mother_tongue,city,state,diet,is_verified,updated_at,photo_urls"
    )
    .neq("id", uid)
    .not("display_name", "is", null)
    .eq("is_banned", false)
    .limit(Math.min(limit * 3, 150));

  if (opposite) q = q.eq("gender", opposite);

  const { data: rows, error } = await q;
  if (error) return c.json({ error: error.message }, 500);

  const filtered = (rows ?? []).filter(
    (r) => !blocked.has(r.id) && !passed.has(r.id) && !!r.display_name
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
      id: r.id,
      display_name: r.display_name,
      age,
      gender: r.gender,
      community: r.community,
      mother_tongue: r.mother_tongue,
      city: r.city,
      state: r.state,
      diet: r.diet ?? null,
      is_verified: r.is_verified,
      photo_urls: r.photo_urls ?? [],
      active_recent: r.updated_at
        ? Date.now() - new Date(r.updated_at).getTime() < 36 * 3600 * 1000
        : false,
    };
  });

  return c.json({ items });
});
