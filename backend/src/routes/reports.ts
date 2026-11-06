import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";

const bodySchema = z
  .object({
    reported_profile_id: z.string().uuid(),
    reason: z.string().min(1).max(2000),
  })
  .strict();

export const reportsRouter = new Hono();

reportsRouter.use("*", requireAuth);

reportsRouter.post("/", async (c) => {
  const uid = c.get("userId");
  const parsed = bodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  if (parsed.data.reported_profile_id === uid) {
    return c.json({ error: "Invalid report" }, 400);
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("reports")
    .insert({
      reporter_id: uid,
      reported_profile_id: parsed.data.reported_profile_id,
      reason: parsed.data.reason,
    })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ report: data });
});
