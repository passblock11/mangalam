import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";

const tokenSchema = z
  .object({
    fcm_token: z.string().min(10).max(512),
    platform: z.enum(["android", "ios", "web"]).optional(),
  })
  .strict();

export const notificationsRouter = new Hono();

notificationsRouter.use("*", requireAuth);

/** Register (upsert) the current device's FCM token for the signed-in user. */
notificationsRouter.post("/token", async (c) => {
  const uid = c.get("userId");
  const parsed = tokenSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("notification_tokens")
    .upsert(
      {
        profile_id: uid,
        fcm_token: parsed.data.fcm_token,
        platform: parsed.data.platform ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,fcm_token" }
    );
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

/** Unregister a token (e.g. on sign-out). */
notificationsRouter.delete("/token", async (c) => {
  const uid = c.get("userId");
  const token = c.req.query("token");
  if (!token) return c.json({ error: "token query param required" }, 400);
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("notification_tokens")
    .delete()
    .eq("profile_id", uid)
    .eq("fcm_token", token);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

/** List notifications (newest first). */
notificationsRouter.get("/", async (c) => {
  const uid = c.get("userId");
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("notifications")
    .select("id,type,title,body,data,read_at,created_at")
    .eq("profile_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});

/** Unread count (for the bell badge). */
notificationsRouter.get("/unread-count", async (c) => {
  const uid = c.get("userId");
  const sb = getSupabaseAdmin();
  const { count, error } = await sb
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", uid)
    .is("read_at", null);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ count: count ?? 0 });
});

/** Mark a single notification as read. */
notificationsRouter.post("/:id/read", async (c) => {
  const uid = c.get("userId");
  const id = c.req.param("id");
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("profile_id", uid);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

/** Mark all notifications as read. */
notificationsRouter.post("/read-all", async (c) => {
  const uid = c.get("userId");
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", uid)
    .is("read_at", null);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});
