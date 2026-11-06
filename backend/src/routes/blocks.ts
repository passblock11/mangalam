import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";

const bodySchema = z.object({ blocked_id: z.string().uuid() }).strict();

export const blocksRouter = new Hono();

blocksRouter.use("*", requireAuth);

blocksRouter.post("/", async (c) => {
  const uid = c.get("userId");
  const parsed = bodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  if (parsed.data.blocked_id === uid) {
    return c.json({ error: "Invalid" }, 400);
  }
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("blocks").upsert(
    {
      blocker_id: uid,
      blocked_id: parsed.data.blocked_id,
    },
    { onConflict: "blocker_id,blocked_id" }
  );
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});
