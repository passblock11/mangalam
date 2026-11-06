import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";

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
  if (
    action === "like" &&
    reverse &&
    (reverse.status === "pending" || reverse.status === "shortlisted")
  ) {
    finalStatus = "mutual";
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

  return c.json({ interaction: row });
});
