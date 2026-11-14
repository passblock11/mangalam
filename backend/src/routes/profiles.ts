import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { activityLabel } from "../activity.js";
import { femalePaidBenefitsWaived, viewerCanSeeContact, viewerContactCosts } from "../contact-access.js";
import { channelsRevealed, presentOtherMember } from "../public-profile.js";
import { revealContact } from "../reveal-contact.js";
import { getSupabaseAdmin } from "../supabase.js";

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
      "id,display_name,phone,whatsapp_number,phone_visible,preferences,date_of_birth,gender,community,mother_tongue,diet,height_cm,profile_for,marital_status,city,state,country,bio,is_verified,updated_at,last_active_at,mangal_dosh,birth_time,birth_place,occupation,education_level,monthly_salary,partner_preferences,photo_urls,verification_status"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);
  if (!row) return c.json({ error: "Not found" }, 404);

  // Numbers are never included until this viewer has spent credits.
  // Email is never included. Photos are omitted when the owner hid them.
  const [canSeeContact, costs, revealed, waived] = await Promise.all([
    viewerCanSeeContact(uid),
    viewerContactCosts(uid),
    channelsRevealed(uid, id),
    femalePaidBenefitsWaived(uid),
  ]);

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

  const shown = presentOtherMember(row as Record<string, unknown>, {
    canAttemptContact: canSeeContact,
    costs,
    revealed: canSeeContact ? revealed : { phone: false, whatsapp: false },
  });

  return c.json({
    profile: {
      ...shown,
      contact_needs_verification: !canSeeContact && waived,
      age,
      activity_label: activityLabel(row.last_active_at as string | null, row.updated_at as string | null),
      active_recent: row.updated_at
        ? Date.now() - new Date(row.updated_at).getTime() < 36 * 3600 * 1000
        : false,
    },
  });
});

const revealSchema = z.object({
  channel: z.enum(["phone", "whatsapp"]),
  confirm: z.boolean().optional(),
});

profilesRouter.post("/:id/reveal-contact", async (c) => {
  const uid = c.get("userId");
  const id = c.req.param("id");
  const parsed = revealSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const result = await revealContact(uid, id, parsed.data.channel, parsed.data.confirm === true);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json(result.body);
});
