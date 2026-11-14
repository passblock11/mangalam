import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { viewerCanSeeContact, viewerContactCosts } from "../contact-access.js";
import { presentOtherMember } from "../public-profile.js";
import { revealContact } from "../reveal-contact.js";
import { decryptMessage, encryptMessage, isEncryptedMessage } from "../chat-crypto.js";
import {
  billingAfterSend,
  quoteMessage,
  recordMessageCharge,
  releaseMessageCharge,
  reserveMessageCharge,
} from "../message-credits.js";
import { getProfileName, notify } from "../notify.js";
import { getSupabaseAdmin } from "../supabase.js";

const MAX_CHAT_BYTES = 5 * 1024 * 1024;

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
    attachment_type: z.enum(["image", "video", "file", "audio"]).optional(),
    attachment_name: z.string().max(255).optional(),
    attachment_mime: z.string().max(255).optional(),
    attachment_size: z.number().int().min(0).max(20_000_000).optional(),
  })
  .strict()
  .refine(
    (v) => (v.body ?? "").length > 0 || v.attachment_url,
    "Provide a body or an attachment"
  );

const ATT_MARK = "\u2063mangalam-att:";

type AttachmentFields = {
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
};

/** Read photos saved in the body before message encryption. */
function unpackAttachment(body: string): { body: string } & AttachmentFields {
  const i = body.lastIndexOf(ATT_MARK);
  if (i < 0) return { body };
  try {
    const meta = JSON.parse(body.slice(i + ATT_MARK.length)) as {
      u?: string;
      t?: string | null;
      n?: string | null;
      m?: string | null;
      s?: number | null;
    };
    if (!meta.u) return { body };
    return {
      body: body.slice(0, i),
      attachment_url: meta.u,
      attachment_type: meta.t ?? null,
      attachment_name: meta.n ?? null,
      attachment_mime: meta.m ?? null,
      attachment_size: meta.s ?? null,
    };
  } catch {
    return { body };
  }
}

type Envelope = {
  b: string;
  e?: 1;
  d?: 1;
  u?: string | null;
  t?: string | null;
  n?: string | null;
  m?: string | null;
  s?: number | null;
};

async function seal(env: Envelope): Promise<string> {
  return encryptMessage(JSON.stringify(env));
}

async function readEnvelope(body: string): Promise<Envelope | null> {
  if (!isEncryptedMessage(body)) return null;
  const parsed = JSON.parse(await decryptMessage(body)) as Envelope;
  return parsed;
}

async function presentMessage(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const raw = String(row.body ?? "");
  if (isEncryptedMessage(raw)) {
    try {
      const env = await readEnvelope(raw);
      const deleted = env?.d === 1;
      return {
        ...row,
        body: deleted ? "" : (env?.b ?? ""),
        deleted,
        edited: env?.e === 1 && !deleted,
        attachment_url: deleted ? null : (env?.u ?? null),
        attachment_type: deleted ? null : (env?.t ?? null),
        attachment_name: deleted ? null : (env?.n ?? null),
        attachment_mime: deleted ? null : (env?.m ?? null),
        attachment_size: deleted ? null : (env?.s ?? null),
      };
    } catch {
      return {
        ...row,
        body: "",
        deleted: false,
        edited: false,
        attachment_url: null,
        attachment_type: null,
        attachment_name: null,
        unreadable: true,
      };
    }
  }
  if (row.attachment_url) return { ...row, deleted: false, edited: false };
  const unpacked = unpackAttachment(raw);
  return { ...row, ...unpacked, deleted: false, edited: false };
}

function chatObjectPath(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const uri = new URL(url);
    const marker = "/profile-photos/";
    const i = uri.pathname.indexOf(marker);
    if (i < 0) return null;
    const path = decodeURIComponent(uri.pathname.slice(i + marker.length));
    if (!path.includes("/chat/") || path.includes("..")) return null;
    return path;
  } catch {
    return null;
  }
}

async function encryptStoredPlaintext(
  rows: Array<Record<string, unknown>>,
  shown: Array<Record<string, unknown>>
): Promise<void> {
  const sb = getSupabaseAdmin();
  for (let i = 0; i < rows.length; i++) {
    const raw = String(rows[i]?.body ?? "");
    if (isEncryptedMessage(raw) || !rows[i]?.id) continue;
    const msg = shown[i];
    if (!msg || msg.unreadable === true) continue;
    try {
      const sealed = await seal({
        b: String(msg.body ?? ""),
        e: msg.edited === true ? 1 : undefined,
        d: msg.deleted === true ? 1 : undefined,
        u: (msg.attachment_url as string | null) ?? null,
        t: (msg.attachment_type as string | null) ?? null,
        n: (msg.attachment_name as string | null) ?? null,
        m: (msg.attachment_mime as string | null) ?? null,
        s: typeof msg.attachment_size === "number" ? msg.attachment_size : null,
      });
      await sb.from("messages").update({ body: sealed }).eq("id", rows[i].id as string);
    } catch {
      /* The next open tries again. The reply still shows the readable text. */
    }
  }
}

async function deleteChatFile(url: string | null | undefined): Promise<void> {
  const path = chatObjectPath(url);
  if (!path) return;
  const { error } = await getSupabaseAdmin().storage.from("profile-photos").remove([path]);
  if (error) throw new Error(error.message);
}

export const conversationsRouter = new Hono();

conversationsRouter.use("*", requireAuth);

/** List conversations for current user with last message preview.
 * folder=primary (default) | sent — primary = last message from other; sent = last message from me.
 */
conversationsRouter.get("/", async (c) => {
  const uid = c.get("userId");
  const folder = c.req.query("folder") ?? "primary";
  const sb = getSupabaseAdmin();
  const [canSee, costs] = await Promise.all([
    viewerCanSeeContact(uid),
    viewerContactCosts(uid),
  ]);
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
      deleted?: boolean;
    } | null;
  }[] = [];
  for (const row of lastMessages ?? []) {
    const conversationId = String(row.conversation_id ?? "");
    if (!conversationId || seenConv.has(conversationId)) continue;
    seenConv.add(conversationId);
    const shown = await presentMessage(row);
    preview.push({
      conversation_id: conversationId,
      last: {
        body: String(shown.body ?? ""),
        created_at: String(row.created_at ?? ""),
        sender_id: String(row.sender_id ?? ""),
        attachment_type: (shown.attachment_type as string | null) ?? null,
        attachment_name: (shown.attachment_name as string | null) ?? null,
        deleted: shown.deleted === true,
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
      "id,display_name,is_verified,community,mother_tongue,city,state,photo_urls,phone,whatsapp_number,phone_visible,preferences"
    )
    .in("id", otherIds);

  const profileById = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      presentOtherMember(p as Record<string, unknown>, {
        canAttemptContact: canSee,
        costs,
      }),
    ])
  );

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
    const createdId = String(conv.id);
    conversationId = createdId;
    const { error: mErr } = await sb.from("conversation_members").insert([
      { conversation_id: createdId, profile_id: uid },
      { conversation_id: createdId, profile_id: other },
    ]);
    if (mErr) {
      await sb.from("conversations").delete().eq("id", createdId);
      return c.json({ error: mErr.message }, 500);
    }

    const first = parsed.data.first_message?.trim();
    if (first) {
      const reserved = await reserveMessageCharge(uid, createdId);
      if (!reserved.ok) {
        await sb.from("conversations").delete().eq("id", createdId);
        return c.json({ error: reserved.error }, reserved.status);
      }
      const inserted = await sb
        .from("messages")
        .insert({
          conversation_id: createdId,
          sender_id: uid,
          body: await seal({ b: first }),
        })
        .select("id")
        .single();
      if (inserted.error || !inserted.data) {
        await releaseMessageCharge(uid, reserved.charged);
        await sb.from("conversations").delete().eq("id", createdId);
        return c.json({ error: inserted.error?.message ?? "Could not send the message." }, 500);
      }
      await recordMessageCharge(
        uid,
        createdId,
        inserted.data.id as string,
        reserved.charged
      );
    }
  }

  return c.json({ conversation_id: conversationId });
});

async function conversationPeer(uid: string, conversationId: string) {
  try {
    const sb = getSupabaseAdmin();
    const { data: members } = await sb
      .from("conversation_members")
      .select("profile_id")
      .eq("conversation_id", conversationId);
    const otherId = (members ?? []).map((m) => m.profile_id).find((id) => id !== uid);
    if (!otherId) return null;
    const { data: profile } = await sb
      .from("profiles")
      .select(
        "id,display_name,is_verified,community,mother_tongue,city,state,photo_urls,phone,whatsapp_number,phone_visible,preferences"
      )
      .eq("id", otherId)
      .maybeSingle();
    if (!profile) return null;
    const [canSee, costs] = await Promise.all([
      viewerCanSeeContact(uid),
      viewerContactCosts(uid),
    ]);
    return presentOtherMember(profile as Record<string, unknown>, {
      canAttemptContact: canSee,
      costs,
    });
  } catch {
    return null;
  }
}

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
    const rows = (fallback.data ?? []) as Array<Record<string, unknown>>;
    const messages = await Promise.all(rows.map((row) => presentMessage(row)));
    void encryptStoredPlaintext(rows, messages);
    return c.json({
      messages,
      other: await conversationPeer(uid, id),
      billing: await quoteMessage(uid, id),
    });
  }
  const rows = (withAttach.data ?? []) as Array<Record<string, unknown>>;
  const messages = await Promise.all(rows.map((row) => presentMessage(row)));
  void encryptStoredPlaintext(rows, messages);
  return c.json({
    messages,
    other: await conversationPeer(uid, id),
    billing: await quoteMessage(uid, id),
  });
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
  if (parsed.data.attachment_type === "video") {
    return c.json({ error: "Video uploads are not available." }, 400);
  }
  if (parsed.data.attachment_url && (parsed.data.attachment_size ?? 0) > MAX_CHAT_BYTES) {
    return c.json({ error: "File is larger than 5 MB." }, 400);
  }
  if (parsed.data.attachment_url && parsed.data.attachment_size == null) {
    return c.json({ error: "File is larger than 5 MB." }, 400);
  }

  const attachment: AttachmentFields = {
    attachment_url: parsed.data.attachment_url ?? null,
    attachment_type: parsed.data.attachment_type ?? null,
    attachment_name: parsed.data.attachment_name ?? null,
    attachment_mime: parsed.data.attachment_mime ?? null,
    attachment_size: parsed.data.attachment_size ?? null,
  };
  const sealed = await seal({
    b: parsed.data.body ?? "",
    u: attachment.attachment_url,
    t: attachment.attachment_type,
    n: attachment.attachment_name,
    m: attachment.attachment_mime,
    s: attachment.attachment_size,
  });

  const reserved = await reserveMessageCharge(uid, id);
  if (!reserved.ok) return c.json({ error: reserved.error }, reserved.status);

  const inserted = await sb
    .from("messages")
    .insert({
      conversation_id: id,
      sender_id: uid,
      body: sealed,
    })
    .select("id,sender_id,body,created_at")
    .single();
  if (inserted.error || !inserted.data) {
    await releaseMessageCharge(uid, reserved.charged);
    return c.json({ error: inserted.error?.message ?? "Could not send the message." }, 500);
  }
  await recordMessageCharge(uid, id, inserted.data.id as string, reserved.charged);
  const data = await presentMessage(inserted.data as Record<string, unknown>);
  const billing = await billingAfterSend(uid, id);

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
        other_name: senderName,
      },
    });
  }

  return c.json({ message: data, billing });
});

const editSchema = z.object({ body: z.string().max(4000) }).strict();

async function loadOwnMessage(
  conversationId: string,
  messageId: string,
  uid: string
): Promise<
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; error: string; status: 403 | 404 | 500 }
> {
  const sb = getSupabaseAdmin();
  const { data: mem } = await sb
    .from("conversation_members")
    .select("profile_id")
    .eq("conversation_id", conversationId)
    .eq("profile_id", uid)
    .maybeSingle();
  if (!mem) return { ok: false, error: "Forbidden", status: 403 };
  const { data: row, error } = await sb
    .from("messages")
    .select("id,sender_id,body,created_at,conversation_id")
    .eq("id", messageId)
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message, status: 500 };
  if (!row) return { ok: false, error: "Not found", status: 404 };
  if (row.sender_id !== uid) {
    return { ok: false, error: "You can only change your own messages.", status: 403 };
  }
  return { ok: true, row: row as Record<string, unknown> };
}

conversationsRouter.patch("/:id/messages/:messageId", async (c) => {
  const uid = c.get("userId");
  const id = c.req.param("id");
  const messageId = c.req.param("messageId");
  const parsed = editSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const loaded = await loadOwnMessage(id, messageId, uid);
  if (!loaded.ok) return c.json({ error: loaded.error }, loaded.status);
  const current = await presentMessage(loaded.row);
  if (current.deleted === true) {
    return c.json({ error: "This message is deleted." }, 400);
  }
  if (current.attachment_url) {
    return c.json({ error: "Media messages cannot be edited." }, 400);
  }
  const nextBody = parsed.data.body.trim();
  if (!nextBody) {
    return c.json({ error: "Message cannot be empty." }, 400);
  }
  const sealed = await seal({ b: nextBody, e: 1 });
  const { data, error } = await getSupabaseAdmin()
    .from("messages")
    .update({ body: sealed })
    .eq("id", messageId)
    .select("id,sender_id,body,created_at")
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ message: await presentMessage(data as Record<string, unknown>) });
});

conversationsRouter.delete("/:id/messages/:messageId", async (c) => {
  const uid = c.get("userId");
  const id = c.req.param("id");
  const messageId = c.req.param("messageId");
  const loaded = await loadOwnMessage(id, messageId, uid);
  if (!loaded.ok) return c.json({ error: loaded.error }, loaded.status);
  const current = await presentMessage(loaded.row);
  if (current.deleted !== true) {
    await deleteChatFile(current.attachment_url as string | null);
  }
  const sealed = await seal({ b: "", d: 1 });
  const { data, error } = await getSupabaseAdmin()
    .from("messages")
    .update({ body: sealed })
    .eq("id", messageId)
    .select("id,sender_id,body,created_at")
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ message: await presentMessage(data as Record<string, unknown>) });
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

  const result = await revealContact(uid, target, "phone", true);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({
    revealed_phone: result.body.value,
    contact_credits_remaining: result.body.contact_credits_remaining,
    credits_charged: result.body.credits_charged,
  });
});
