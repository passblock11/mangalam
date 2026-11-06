import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";

const patchSchema = z
  .object({
    display_name: z.string().min(1).max(120).optional(),
    date_of_birth: z.string().optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    community: z.string().max(120).optional(),
    mother_tongue: z.string().max(80).optional(),
    diet: z.string().max(80).optional(),
    height_cm: z.number().int().min(100).max(250).optional(),
    profile_for: z.string().max(80).optional(),
    marital_status: z.string().max(80).optional(),
    city: z.string().max(120).optional(),
    state: z.string().max(120).optional(),
    country: z.string().max(80).optional(),
    bio: z.string().max(4000).optional(),
    phone_visible: z.boolean().optional(),
    preferences: z.record(z.string(), z.unknown()).optional(),
    partner_preferences: z.record(z.string(), z.unknown()).optional(),
    app_language: z.string().max(20).optional(),
    mangal_dosh: z.string().max(40).optional(),
    birth_time: z.string().max(20).optional(),
    birth_place: z.string().max(200).optional(),
    occupation: z.string().max(120).optional(),
    education_level: z.string().max(120).optional(),
    monthly_salary: z.string().max(120).optional(),
    last_active_at: z.string().optional(),
  })
  .strict();

export const meRouter = new Hono();

meRouter.use("*", requireAuth);

meRouter.get("/", async (c) => {
  const uid = c.get("userId");
  const sb = getSupabaseAdmin();
  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("*")
    .eq("id", uid)
    .maybeSingle();
  if (pErr) return c.json({ error: pErr.message }, 500);
  const { data: wallet, error: wErr } = await sb
    .from("wallets")
    .select("*")
    .eq("profile_id", uid)
    .maybeSingle();
  if (wErr) return c.json({ error: wErr.message }, 500);
  return c.json({ profile: profile ?? null, wallet: wallet ?? null });
});

meRouter.patch("/", async (c) => {
  const uid = c.get("userId");
  const body = await c.req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const sb = getSupabaseAdmin();

  let partnerPatch: Record<string, unknown> | undefined;
  const { partner_preferences: incomingPartner, last_active_at: _skip, ...rest } =
    parsed.data;
  if (incomingPartner && typeof incomingPartner === "object") {
    const { data: existing } = await sb
      .from("profiles")
      .select("partner_preferences")
      .eq("id", uid)
      .maybeSingle();
    const prev =
      existing?.partner_preferences &&
      typeof existing.partner_preferences === "object"
        ? (existing.partner_preferences as Record<string, unknown>)
        : {};
    partnerPatch = { ...prev, ...incomingPartner };
  }

  const { data, error } = await sb
    .from("profiles")
    .update({
      ...rest,
      ...(partnerPatch !== undefined ? { partner_preferences: partnerPatch } : {}),
      updated_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    })
    .eq("id", uid)
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ profile: data });
});
