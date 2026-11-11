import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";
import { notify, getProfileName } from "../notify.js";

const bodySchema = z
  .object({
    to_profile_id: z.string().uuid(),
    action: z.enum(["like", "pass", "shortlist"]),
  })
  .strict();

export const interactionsRouter = new Hono();

interactionsRouter.use("*", requireAuth);

interactionsRouter.post("/", async (c) => {
  const uid = c.get("userId");
  const parsed = bodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const { to_profile_id, action } = parsed.data;
  if (to_profile_id === uid) {
    return c.json({ error: "Cannot interact with self" }, 400);
  }

  const status =
    action === "pass"
      ? "passed"
      : action === "shortlist"
        ? "shortlisted"
        : "pending";

  const sb = getSupabaseAdmin();

  const { data: reverse } = await sb
    .from("interactions")
    .select("id,status,from_profile_id")
    .eq("from_profile_id", to_profile_id)
    .eq("to_profile_id", uid)
    .maybeSingle();

  let finalStatus = status;
  let becameMutual = false;
  if (
    action === "like" &&
    reverse &&
    (reverse.status === "pending" || reverse.status === "shortlisted")
  ) {
    finalStatus = "mutual";
    becameMutual = true;
    await sb
      .from("interactions")
      .update({ status: "mutual", updated_at: new Date().toISOString() })
      .eq("id", reverse.id);
  }

  const { data: row, error } = await sb
    .from("interactions")
    .upsert(
      {
        from_profile_id: uid,
        to_profile_id,
        status: finalStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "from_profile_id,to_profile_id" }
    )
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // ── Notifications (non-blocking; errors swallowed inside notify()) ──────────
  const senderName = await getProfileName(uid);
  if (becameMutual) {
    // It's a mutual match — notify both sides.
    await notify({
      profile_id: to_profile_id,
      type: "match",
      title: "It's a mutual match! 🎉",
      body: `${senderName} liked you back. You can now chat.`,
      data: { from_profile_id: uid, interaction_id: row.id },
    });
    const otherName = await getProfileName(to_profile_id);
    await notify({
      profile_id: uid,
      type: "match",
      title: "It's a mutual match! 🎉",
      body: `${otherName} liked you back. You can now chat.`,
      data: { from_profile_id: to_profile_id, interaction_id: row.id },
    });
  } else if (action === "like") {
    await notify({
      profile_id: to_profile_id,
      type: "like",
      title: "You received a new like",
      body: `${senderName} liked your profile.`,
      data: { from_profile_id: uid, interaction_id: row.id },
    });
  } else if (action === "shortlist") {
    await notify({
      profile_id: to_profile_id,
      type: "shortlist",
      title: "You were shortlisted",
      body: `${senderName} shortlisted your profile.`,
      data: { from_profile_id: uid, interaction_id: row.id },
    });
  }
  // 'pass' produces no notification.

  return c.json({ interaction: row });
});
