import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";

const bodySchema = z.object({ viewed_id: z.string().uuid() }).strict();

export const viewsRouter = new Hono();

viewsRouter.use("*", requireAuth);

viewsRouter.post("/", async (c) => {
  const uid = c.get("userId");
  const parsed = bodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  if (parsed.data.viewed_id === uid) {
    return c.json({ error: "Invalid" }, 400);
  }
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("profile_views").insert({
    viewer_id: uid,
    viewed_id: parsed.data.viewed_id,
  });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});
