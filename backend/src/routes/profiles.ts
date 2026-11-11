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
      "id,display_name,phone,whatsapp_number,phone_visible,date_of_birth,gender,community,mother_tongue,diet,height_cm,profile_for,marital_status,city,state,country,bio,is_verified,updated_at,last_active_at,mangal_dosh,birth_time,birth_place,occupation,education_level,monthly_salary,partner_preferences,photo_urls,verification_status"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);
  if (!row) return c.json({ error: "Not found" }, 404);

  // ── Contact access control ──────────────────────────────────────
  // Owner's contact (phone / whatsapp) is visible to a viewer ONLY if:
  //   1. the owner has enabled phone_visible, AND
  //   2. the viewer is verified (is_verified = true), AND
  //   3. the viewer has an active premium (paid) wallet.
  // Otherwise the viewer must chat and request a reveal.
  const { data: viewer } = await sb
    .from("profiles")
    .select("is_verified")
    .eq("id", uid)
    .maybeSingle();
  const viewerVerified = viewer?.is_verified === true;

  let viewerPaid = false;
  const { data: vw } = await sb
    .from("wallets")
    .select("premium_until,contact_credits")
    .eq("profile_id", uid)
    .maybeSingle();
  if (vw?.premium_until) {
    const until = new Date(vw.premium_until as string).getTime();
    if (Number.isFinite(until) && until > Date.now()) viewerPaid = true;
  }
  const canSeeContact = viewerVerified && viewerPaid;

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

  const {
    phone,
    whatsapp_number,
    phone_visible,
    selfie_url: _selfie,
    govt_id_url: _govt,
    verification_status: _vs,
    ...rest
  } = row as Record<string, unknown> & {
    phone?: string | null;
    whatsapp_number?: string | null;
    phone_visible?: boolean;
    selfie_url?: string | null;
    govt_id_url?: string | null;
    verification_status?: string;
  };

  const ownerAllows = phone_visible === true;
  const visiblePhone = ownerAllows && canSeeContact ? phone : null;
  const visibleWhatsapp = ownerAllows && canSeeContact ? whatsapp_number : null;

  return c.json({
    profile: {
      ...rest,
      phone: visiblePhone,
      whatsapp_number: visibleWhatsapp,
      contact_visible: visiblePhone != null || visibleWhatsapp != null,
      contact_locked: !canSeeContact,
      contact_owner_disabled: !ownerAllows,
      age,
      activity_label: activityLabel(row.last_active_at as string | null, row.updated_at as string | null),
      active_recent: row.updated_at
        ? Date.now() - new Date(row.updated_at).getTime() < 36 * 3600 * 1000
        : false,
    },
  });
});
