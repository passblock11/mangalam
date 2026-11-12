import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";
import { notify, getProfileName } from "../notify.js";

const createSchema = z
  .object({
    other_profile_id: z.string().uuid(),
    first_message: z.string().min(1).max(4000).optional(),
  })
  .strict();

const messageSchema = z
  .object({
    body: z.string().max(4000).optional().default(""),
    attachment_url: z.string().url().max(2048).optional(),
    attachment_type: z
      .enum(["image", "video", "file", "audio"])
      .optional(),
    attachment_name: z.string().max(255).optional(),
    attachment_mime: z.string().max(255).optional(),
    attachment_size: z.number().int().min(0).max(104857600).optional(),
  })
  .strict()
  .refine(
    (v) => (v.body ?? "").length > 0 || v.attachment_url,
    "Provide a body or an attachment"
  );

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

  // Prefer attachment metadata for previews; fall back if migration 0012
  // has not been applied yet (columns missing).
  let lastMessages: Array<Record<string, unknown>> | null = null;
  {
    const withAttach = await sb
      .from("messages")
      .select(
        "id,conversation_id,body,created_at,sender_id,attachment_type,attachment_name"
      )
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false });
    if (withAttach.error) {
      const fallback = await sb
        .from("messages")
        .select("id,conversation_id,body,created_at,sender_id")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false });
      if (fallback.error) return c.json({ error: fallback.error.message }, 500);
      lastMessages = (fallback.data ?? []) as Array<Record<string, unknown>>;
    } else {
      lastMessages = (withAttach.data ?? []) as Array<Record<string, unknown>>;
    }
  }

  const seenConv = new Set<string>();
  const preview: {
    conversation_id: string;
    last: {
      body: string;
      created_at: string;
      sender_id: string;
      attachment_type?: string | null;
      attachment_name?: string | null;
    } | null;
  }[] = [];
  for (const row of lastMessages ?? []) {
    const conversationId = String(row.conversation_id ?? "");
    if (!conversationId || seenConv.has(conversationId)) continue;
    seenConv.add(conversationId);
    preview.push({
      conversation_id: conversationId,
      last: {
        body: String(row.body ?? ""),
        created_at: String(row.created_at ?? ""),
        sender_id: String(row.sender_id ?? ""),
        attachment_type: (row.attachment_type as string | null) ?? null,
        attachment_name: (row.attachment_name as string | null) ?? null,
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
      "id,display_name,is_verified,community,mother_tongue,city,state,photo_urls"
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

  // Primary = full inbox (all chats), matching matrimonial/dating UX.
  // Sent = chats where you sent the latest message (outbound filter).
  // Previously Primary hid chats you started (last msg from you), which
  // made the Messages tab look empty right after opening a conversation.
  if (folder === "sent") {
    conversations = conversations.filter((x) => x.last_message?.sender_id === uid);
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

  // Anyone can message another member. Blocked pairs are still refused.
  const { data: blk1 } = await sb
    .from("blocks")
    .select("blocker_id")
    .eq("blocker_id", uid)
    .eq("blocked_id", other)
    .maybeSingle();
  const { data: blk2 } = await sb
    .from("blocks")
    .select("blocker_id")
    .eq("blocker_id", other)
    .eq("blocked_id", uid)
    .maybeSingle();
  if (blk1 || blk2) {
    return c.json({ error: "You cannot message this member." }, 403);
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

  const withAttach = await sb
    .from("messages")
    .select(
      "id,sender_id,body,created_at,attachment_url,attachment_type,attachment_name,attachment_mime,attachment_size"
    )
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (withAttach.error) {
    const fallback = await sb
      .from("messages")
      .select("id,sender_id,body,created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (fallback.error) return c.json({ error: fallback.error.message }, 500);
    return c.json({ messages: fallback.data ?? [] });
  }
  return c.json({ messages: withAttach.data ?? [] });
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
      body: parsed.data.body ?? "",
      attachment_url: parsed.data.attachment_url ?? null,
      attachment_type: parsed.data.attachment_type ?? null,
      attachment_name: parsed.data.attachment_name ?? null,
      attachment_mime: parsed.data.attachment_mime ?? null,
      attachment_size: parsed.data.attachment_size ?? null,
    })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);

  // ── Notify the other conversation member (non-blocking) ─────────────────────
  const { data: members } = await sb
    .from("conversation_members")
    .select("profile_id")
    .eq("conversation_id", id);
  const recipientId = (members ?? [])
    .map((m) => m.profile_id)
    .find((pid) => pid !== uid);
  if (recipientId) {
    const senderName = await getProfileName(uid);
    const notifBody =
      (parsed.data.body ?? "").length > 0
        ? parsed.data.body
        : parsed.data.attachment_type === "image"
          ? "📷 Photo"
          : parsed.data.attachment_type === "video"
            ? "🎥 Video"
            : parsed.data.attachment_type === "audio"
              ? "🎤 Voice message"
              : "📎 File";
    await notify({
      profile_id: recipientId,
      type: "message",
      title: senderName,
      body: notifBody,
      data: {
        conversation_id: id,
        from_profile_id: uid,
      },
    });
  }

  return c.json({ message: data });
});

/** Reveal the other member's phone. Paid + verified viewers only. */
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

  const { data: me } = await sb
    .from("profiles")
    .select("is_verified")
    .eq("id", uid)
    .maybeSingle();
  const { data: wallet, error: wErr } = await sb
    .from("wallets")
    .select("contact_credits,premium_until")
    .eq("profile_id", uid)
    .maybeSingle();
  if (wErr || !wallet) return c.json({ error: "Wallet not found" }, 500);

  const premiumUntil = wallet.premium_until
    ? new Date(wallet.premium_until as string).getTime()
    : 0;
  const paid = Number.isFinite(premiumUntil) && premiumUntil > Date.now();
  const verified = me?.is_verified === true;
  if (!verified || !paid) {
    return c.json(
      {
        error:
          "Phone numbers are shown only to verified members with an active premium plan.",
      },
      403
    );
  }

  const { data: targetProfile } = await sb
    .from("profiles")
    .select("id,phone,phone_visible")
    .eq("id", target)
    .single();
  const phone = (targetProfile?.phone ?? "").toString().trim();
  if (!phone || targetProfile?.phone_visible === false) {
    return c.json(
      { error: "This member has not shared a phone number." },
      404
    );
  }

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

  return c.json({
    revealed_phone: phone,
    contact_credits_remaining: wallet.contact_credits - 1,
  });
});
