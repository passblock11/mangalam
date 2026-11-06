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
    const { data: rows, error } = await sb
      .from("interactions")
      .select("to_profile_id,updated_at")
      .eq("from_profile_id", uid)
      .eq("status", "shortlisted")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) return c.json({ error: error.message }, 500);
    const ids = (rows ?? []).map((r) => r.to_profile_id);
    if (ids.length === 0) return c.json({ items: [] });

    const { data: profs, error: pErr } = await sb
      .from("profiles")
      .select(
        "id,display_name,date_of_birth,gender,community,mother_tongue,city,state,is_verified,updated_at"
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

  const limit = Math.min(Number(c.req.query("limit")) || 20, 50);

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
    .select("to_profile_id,from_profile_id")
    .or(`from_profile_id.eq.${uid},to_profile_id.eq.${uid}`);

  const seen = new Set<string>([uid]);
  for (const row of interacted ?? []) {
    seen.add(row.from_profile_id);
    seen.add(row.to_profile_id);
  }

  let q = sb
    .from("profiles")
    .select(
      "id,display_name,date_of_birth,gender,community,mother_tongue,city,state,is_verified,updated_at"
    )
    .neq("id", uid)
    .limit(limit);

  if (me.state) q = q.eq("state", me.state);
  if (opposite) q = q.eq("gender", opposite);

  const { data: rows, error } = await q;
  if (error) return c.json({ error: error.message }, 500);

  const filtered = (rows ?? []).filter((r) => !blocked.has(r.id) && !seen.has(r.id));

  const now = new Date();
  const items = filtered.map((r) => {
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
      active_recent: r.updated_at
        ? Date.now() - new Date(r.updated_at).getTime() < 36 * 3600 * 1000
        : false,
    };
  });

  return c.json({ items });
});
