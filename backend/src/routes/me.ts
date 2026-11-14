import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";

const patchSchema = z
  .object({
    display_name: z.string().min(1).max(120).optional(),
    date_of_birth: z.string().optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    religion: z.string().max(80).optional(),
    community: z.string().max(120).optional(),
    mother_tongue: z.string().max(80).optional(),
    diet: z.string().max(80).optional(),
    height_cm: z.number().int().min(100).max(250).optional(),
    profile_for: z.string().max(80).optional(),
    marital_status: z.string().max(80).optional(),
    phone: z.string().min(10).max(40).optional(),
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
    photo_urls: z.array(z.string().url().max(500)).max(6).optional(),
    whatsapp_number: z.string().max(40).optional(),
    selfie_url: z.string().url().max(500).optional(),
    govt_id_url: z.string().url().max(500).optional(),
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
  const tokenEmail = (c.get("user") as { email?: string } | undefined)?.email ?? null;
  return c.json({
    profile: profile ? { ...profile, email: tokenEmail } : null,
    wallet: wallet ?? null,
  });
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
  let preferencesPatch: Record<string, unknown> | undefined;
  const {
    partner_preferences: incomingPartner,
    preferences: incomingPreferences,
    last_active_at: _skip,
    ...rest
  } = parsed.data;
  if (incomingPreferences && typeof incomingPreferences === "object") {
    const { data: existingPrefs } = await sb
      .from("profiles")
      .select("preferences")
      .eq("id", uid)
      .maybeSingle();
    const prevPrefs =
      existingPrefs?.preferences && typeof existingPrefs.preferences === "object"
        ? (existingPrefs.preferences as Record<string, unknown>)
        : {};
    preferencesPatch = { ...prevPrefs, ...incomingPreferences };
  }
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

  const phone = typeof rest.phone === "string" ? rest.phone.trim() : "";
  if (phone) {
    const { data: taken, error: lookupErr } = await sb
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .neq("id", uid)
      .maybeSingle();
    if (!lookupErr && taken) {
      return c.json({ error: duplicatePhoneMessage }, 409);
    }
  }

  const { data, error } = await sb
    .from("profiles")
    .update({
      ...rest,
      ...(partnerPatch !== undefined ? { partner_preferences: partnerPatch } : {}),
      ...(preferencesPatch !== undefined ? { preferences: preferencesPatch } : {}),
      updated_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    })
    .eq("id", uid)
    .select()
    .single();
  if (error) {
    const friendly = friendlyProfileError(error);
    return c.json({ error: friendly.error }, friendly.status);
  }
  return c.json({ profile: data });
});

const duplicatePhoneMessage =
  "This phone number is already registered with another account.";

function friendlyProfileError(error: {
  code?: string;
  message: string;
  details?: string | null;
}): { status: 409 | 500; error: string } {
  const blob = `${error.message} ${error.details ?? ""}`.toLowerCase();
  const duplicatePhone =
    blob.includes("profiles_phone_key") ||
    blob.includes("profile_phone_key") ||
    (error.code === "23505" && (blob.includes("phone_key") || blob.includes("(phone)")));
  if (duplicatePhone) return { status: 409, error: duplicatePhoneMessage };
  return { status: 500, error: error.message };
}
