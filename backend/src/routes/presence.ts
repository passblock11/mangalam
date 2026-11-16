import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { recordPresence } from "../presence.js";

const bodySchema = z.object({ online: z.boolean() }).strict();

export const presenceRouter = new Hono();

presenceRouter.use("*", requireAuth);

presenceRouter.post("/", async (c) => {
  const parsed = bodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid presence update" }, 400);
  const stored = await recordPresence(c.get("userId"), parsed.data.online);
  return c.json({ ok: stored });
});
