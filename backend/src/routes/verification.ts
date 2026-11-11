import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";

export const verificationRouter = new Hono();

verificationRouter.use("*", requireAuth);

const submitSchema = z.object({
  selfie_url: z.string().max(500),
  govt_id_url: z.string().max(500),
});

/** Submit verification: selfie + govt ID. Sets status = pending. */
verificationRouter.post("/submit", async (c) => {
  const uid = c.get("userId");
  const body = await c.req.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("profiles")
    .update({
      selfie_url: parsed.data.selfie_url,
      govt_id_url: parsed.data.govt_id_url,
      verification_status: "pending",
      verification_submitted_at: new Date().toISOString(),
      verification_reviewed_at: null,
      verification_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", uid);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true, status: "pending" });
});

/** Current verification status for the signed-in user. */
verificationRouter.get("/status", async (c) => {
  const uid = c.get("userId");
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("profiles")
    .select(
      "verification_status,selfie_url,govt_id_url,verification_submitted_at,verification_reviewed_at,verification_note,is_verified"
    )
    .eq("id", uid)
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ verification: data ?? null });
});
