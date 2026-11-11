import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";

const bodySchema = z
  .object({
    reported_profile_id: z.string().uuid(),
    // New rich fields
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(1).max(4000).optional(),
    category: z
      .enum(["scam_fraud", "harassment", "fake_profile", "inappropriate", "illegal", "other"])
      .optional(),
    screenshot_urls: z.array(z.string().url().max(500)).max(6).optional(),
    // Legacy field (still accepted for backward compat with old app builds)
    reason: z.string().min(1).max(2000).optional(),
  })
  .strict();

export const reportsRouter = new Hono();

reportsRouter.use("*", requireAuth);

/** Submit a report / complaint against another profile. */
reportsRouter.post("/", async (c) => {
  const uid = c.get("userId");
  const parsed = bodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  if (parsed.data.reported_profile_id === uid) {
    return c.json({ error: "Invalid report" }, 400);
  }

  const sb = getSupabaseAdmin();

  // Require at least a description (new flow) or a reason (legacy flow).
  const description = parsed.data.description?.trim();
  const reason = parsed.data.reason?.trim();
  const title = parsed.data.title?.trim();
  if (!description && !reason) {
    return c.json({ error: "A description or reason is required." }, 400);
  }

  const { data, error } = await sb
    .from("reports")
    .insert({
      reporter_id: uid,
      reported_profile_id: parsed.data.reported_profile_id,
      title: title ?? null,
      description: description ?? reason ?? null,
      category: parsed.data.category ?? "other",
      screenshot_urls: parsed.data.screenshot_urls ?? [],
      // keep legacy `reason` column populated for backward-compat queries
      reason: reason ?? description?.slice(0, 2000) ?? "",
      status: "open",
    })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ report: data });
});

/** List reports submitted by the signed-in user (for "My reports" in-app). */
reportsRouter.get("/mine", async (c) => {
  const uid = c.get("userId");
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("reports")
    .select("id,title,description,category,status,created_at,reviewed_at,resolution")
    .eq("reporter_id", uid)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ reports: data ?? [] });
});
