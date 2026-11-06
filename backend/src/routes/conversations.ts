import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";

const createSchema = z
  .object({
    other_profile_id: z.string().uuid(),
    first_message: z.string().min(1).max(4000).optional(),
  })
  .strict();

const messageSchema = z.object({ body: z.string().min(1).max(4000) }).strict();

export const conversationsRouter = new Hono();

conversationsRouter.use("*", requireAuth);

/** List conversations for current user with last message preview.
 * folder=primary (default) | sent — primary = last message from other; sent = last message from me.
 */
conversationsRouter.get("/", async (c) => {
  const uid = c.get("userId");
  const folder = c.req.query("folder") ?? "primary";
  const sb = getSupabaseAdmin();
  const { data: memberships, error } = await sb
    .from("conversation_members")
    .select("conversation_id")
    .eq("profile_id", uid);
  if (error) return c.json({ error: error.message }, 500);
  const convIds = [...new Set((memberships ?? []).map((m) => m.conversation_id))];
  if (convIds.length === 0) return c.json({ conversations: [] });

  const { data: lastMessages, error: lmErr } = await sb
    .from("messages")
    .select("id,conversation_id,body,created_at,sender_id")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: false });
  if (lmErr) return c.json({ error: lmErr.message }, 500);

  const seenConv = new Set<string>();
  const preview: {
    conversation_id: string;
    last: { body: string; created_at: string; sender_id: string } | null;
  }[] = [];
  for (const row of lastMessages ?? []) {
    if (seenConv.has(row.conversation_id)) continue;
    seenConv.add(row.conversation_id);
    preview.push({
      conversation_id: row.conversation_id,
      last: {
        body: row.body,
        created_at: row.created_at,
        sender_id: row.sender_id,
      },
    });
  }

  const otherMemberQueries = await Promise.all(
    preview.map(async (p) => {
      const { data: members } = await sb
        .from("conversation_members")
        .select("profile_id")
        .eq("conversation_id", p.conversation_id);
      const otherId = (members ?? []).map((m) => m.profile_id).find((id) => id !== uid);
      return { conversation_id: p.conversation_id, other_id: otherId ?? null };
    })
  );

  const otherIds = [
    ...new Set(otherMemberQueries.map((o) => o.other_id).filter(Boolean) as string[]),
  ];
  const { data: profiles } = await sb
    .from("profiles")
    .select(
      "id,display_name,is_verified,community,mother_tongue,city,state"
    )
    .in("id", otherIds);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  let conversations = preview.map((p) => {
    const other = otherMemberQueries.find((x) => x.conversation_id === p.conversation_id);
    return {
      id: p.conversation_id,
      other_profile: other?.other_id ? profileById.get(other.other_id) ?? null : null,
      last_message: p.last,
    };
  });

  if (folder === "sent") {
    conversations = conversations.filter((x) => x.last_message?.sender_id === uid);
  } else {
    conversations = conversations.filter(
      (x) =>
        x.last_message == null || x.last_message.sender_id !== uid
    );
  }

  return c.json({ conversations });
});

/** Start or return existing conversation with mutual match */
conversationsRouter.post("/", async (c) => {
  const uid = c.get("userId");
  const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const other = parsed.data.other_profile_id;
  if (other === uid) return c.json({ error: "Invalid other user" }, 400);

  const sb = getSupabaseAdmin();

  const { data: m1 } = await sb
    .from("interactions")
    .select("id")
    .eq("status", "mutual")
    .eq("from_profile_id", uid)
    .eq("to_profile_id", other)
    .maybeSingle();
  const { data: m2 } = await sb
    .from("interactions")
    .select("id")
    .eq("status", "mutual")
    .eq("from_profile_id", other)
    .eq("to_profile_id", uid)
    .maybeSingle();

  if (!m1 && !m2) {
    return c.json({ error: "Mutual match required to start chat" }, 403);
  }

  const { data: existingA } = await sb
    .from("conversation_members")
    .select("conversation_id")
    .eq("profile_id", uid);
  const myConvs = new Set((existingA ?? []).map((r) => r.conversation_id));

  const { data: existingB } = await sb
    .from("conversation_members")
    .select("conversation_id,profile_id")
    .in("conversation_id", [...myConvs]);

  let conversationId: string | null = null;
  const byConv = new Map<string, Set<string>>();
  for (const row of existingB ?? []) {
    if (!byConv.has(row.conversation_id)) byConv.set(row.conversation_id, new Set());
    byConv.get(row.conversation_id)!.add(row.profile_id);
  }
  for (const [cid, members] of byConv) {
    if (members.has(uid) && members.has(other)) {
      conversationId = cid;
      break;
    }
  }

  if (!conversationId) {
    const { data: conv, error: cErr } = await sb
      .from("conversations")
      .insert({})
      .select("id")
      .single();
    if (cErr || !conv) return c.json({ error: cErr?.message ?? "create failed" }, 500);
    conversationId = conv.id;
    const { error: mErr } = await sb.from("conversation_members").insert([
      { conversation_id: conversationId, profile_id: uid },
      { conversation_id: conversationId, profile_id: other },
    ]);
    if (mErr) return c.json({ error: mErr.message }, 500);

    const first = parsed.data.first_message?.trim();
    if (first) {
      await sb.from("messages").insert({
        conversation_id: conversationId,
        sender_id: uid,
        body: first,
      });
    }
  }

  return c.json({ conversation_id: conversationId });
});

conversationsRouter.get("/:id/messages", async (c) => {
  const uid = c.get("userId");
  const id = c.req.param("id");
  const sb = getSupabaseAdmin();
  const { data: mem } = await sb
    .from("conversation_members")
    .select("profile_id")
    .eq("conversation_id", id)
    .eq("profile_id", uid)
    .maybeSingle();
  if (!mem) return c.json({ error: "Forbidden" }, 403);

  const { data, error } = await sb
    .from("messages")
    .select("id,sender_id,body,created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ messages: data ?? [] });
});

conversationsRouter.post("/:id/messages", async (c) => {
  const uid = c.get("userId");
  const id = c.req.param("id");
  const parsed = messageSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const sb = getSupabaseAdmin();
  const { data: mem } = await sb
    .from("conversation_members")
    .select("profile_id")
    .eq("conversation_id", id)
    .eq("profile_id", uid)
    .maybeSingle();
  if (!mem) return c.json({ error: "Forbidden" }, 403);

  const { data, error } = await sb
    .from("messages")
    .insert({
      conversation_id: id,
      sender_id: uid,
      body: parsed.data.body,
    })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ message: data });
});

/** Spend one contact credit and record phone reveal for the other member */
conversationsRouter.post("/:id/reveal-phone", async (c) => {
  const uid = c.get("userId");
  const id = c.req.param("id");
  const sb = getSupabaseAdmin();

  const { data: members, error: mErr } = await sb
    .from("conversation_members")
    .select("profile_id")
    .eq("conversation_id", id);
  if (mErr) return c.json({ error: mErr.message }, 500);
  const ids = (members ?? []).map((x) => x.profile_id);
  if (!ids.includes(uid)) return c.json({ error: "Forbidden" }, 403);
  const target = ids.find((x) => x !== uid);
  if (!target) return c.json({ error: "Invalid conversation" }, 400);

  const { data: wallet, error: wErr } = await sb
    .from("wallets")
    .select("contact_credits")
    .eq("profile_id", uid)
    .single();
  if (wErr || !wallet) return c.json({ error: "Wallet not found" }, 500);
  if (wallet.contact_credits < 1) {
    return c.json({ error: "Insufficient contact credits" }, 402);
  }

  const { error: upErr } = await sb
    .from("wallets")
    .update({
      contact_credits: wallet.contact_credits - 1,
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", uid);
  if (upErr) return c.json({ error: upErr.message }, 500);

  await sb.from("phone_reveals").insert({
    conversation_id: id,
    revealer_id: uid,
    target_id: target,
  });

  const { data: targetProfile } = await sb
    .from("profiles")
    .select("id,phone,phone_visible")
    .eq("id", target)
    .single();

  return c.json({
    revealed_phone: targetProfile?.phone ?? null,
    contact_credits_remaining: wallet.contact_credits - 1,
  });
});
