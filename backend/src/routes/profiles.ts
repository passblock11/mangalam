import { Hono } from "hono";
import { requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";
import { activityLabel } from "../activity.js";

/** Public profile view (no phone); caller must be authenticated. */
export const profilesRouter = new Hono();

profilesRouter.use("*", requireAuth);

profilesRouter.get("/:id", async (c) => {
  const uid = c.get("userId");
  const id = c.req.param("id");
  if (id === uid) {
    return c.json({ error: "Use /v1/me for own profile" }, 400);
  }

  const sb = getSupabaseAdmin();

  const { data: blk1 } = await sb
    .from("blocks")
    .select("blocker_id")
    .eq("blocker_id", uid)
    .eq("blocked_id", id)
    .maybeSingle();
  const { data: blk2 } = await sb
    .from("blocks")
    .select("blocker_id")
    .eq("blocker_id", id)
    .eq("blocked_id", uid)
    .maybeSingle();

  if (blk1 || blk2) {
    return c.json({ error: "Not found" }, 404);
  }

  const { data: row, error } = await sb
    .from("profiles")
    .select(
      "id,display_name,phone,phone_visible,date_of_birth,gender,community,mother_tongue,diet,height_cm,profile_for,marital_status,city,state,country,bio,is_verified,updated_at,last_active_at,mangal_dosh,birth_time,birth_place,occupation,education_level,monthly_salary,partner_preferences,photo_urls"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);
  if (!row) return c.json({ error: "Not found" }, 404);

  // Log view (best-effort)
  await sb.from("profile_views").upsert(
    {
      viewer_id: uid,
      viewed_id: id,
      viewed_at: new Date().toISOString(),
    },
    { onConflict: "viewer_id,viewed_id" }
  );

  let age: number | null = null;
  if (row.date_of_birth) {
    const d = new Date(row.date_of_birth);
    age = Math.floor(
      (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000)
    );
  }

  const { phone, phone_visible, ...rest } = row as Record<string, unknown> & {
    phone?: string | null;
    phone_visible?: boolean;
  };

  return c.json({
    profile: {
      ...rest,
      phone: phone_visible ? phone : null,
      age,
      activity_label: activityLabel(row.last_active_at as string | null, row.updated_at as string | null),
      active_recent: row.updated_at
        ? Date.now() - new Date(row.updated_at).getTime() < 36 * 3600 * 1000
        : false,
    },
  });
});
