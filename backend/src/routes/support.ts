import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";

const categories = ["account", "verification", "payment", "technical", "other"] as const;

const createSchema = z
  .object({
    subject: z.string().trim().min(3).max(120),
    category: z.enum(categories),
    body: z.string().trim().min(10).max(2000),
    attachment_urls: z.array(z.string().trim().url().max(800)).max(4).optional(),
  })
  .strict();

const replySchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
  })
  .strict();

export const supportRouter = new Hono();

supportRouter.use("*", requireAuth);

supportRouter.get("/tickets", async (c) => {
  const uid = c.get("userId");
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("support_tickets")
    .select("id,ticket_number,subject,category,status,created_at,updated_at")
    .eq("profile_id", uid)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ tickets: data ?? [] });
});

supportRouter.post("/tickets", async (c) => {
  const uid = c.get("userId");
  const raw = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const error =
      field === "attachment_urls"
        ? "One of the photos could not be attached."
        : field === "category"
          ? "Choose a topic."
          : "Add a subject and describe what happened.";
    return c.json({ error }, 400);
  }
  const photos = ownSupportPhotos(uid, parsed.data.attachment_urls ?? []);
  if (photos == null) {
    return c.json({ error: "One of the photos could not be attached." }, 400);
  }
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  const created = await sb
    .from("support_tickets")
    .insert({
      profile_id: uid,
      subject: parsed.data.subject,
      category: parsed.data.category,
      status: "open",
      created_at: now,
      updated_at: now,
    })
    .select("id,ticket_number,subject,category,status,created_at,updated_at")
    .single();
  if (created.error || !created.data) {
    return c.json({ error: created.error?.message ?? "Could not open the ticket." }, 500);
  }
  const ticketId = created.data.id as string;
  const messageRow: Record<string, unknown> = {
    ticket_id: ticketId,
    author_role: "member",
    body: parsed.data.body,
  };
  if (photos.length > 0) messageRow.attachment_urls = photos;
  const message = await sb.from("support_messages").insert(messageRow);
  if (message.error) {
    const hint = message.error.message.includes("attachment_urls")
      ? " Run supabase/migrations/0019_support_attachments.sql in the behlr SQL editor."
      : "";
    return c.json({ error: `${message.error.message}${hint}` }, 500);
  }
  await sb.from("support_ticket_events").insert({
    ticket_id: ticketId,
    from_status: null,
    to_status: "open",
    actor_role: "member",
  });
  return c.json({ ticket: created.data });
});

supportRouter.get("/tickets/:id", async (c) => {
  const uid = c.get("userId");
  const id = c.req.param("id");
  const sb = getSupabaseAdmin();
  const ticket = await loadOwnTicket(sb, uid, id);
  if (!ticket) return c.json({ error: "Ticket not found" }, 404);
  const [messages, events] = await Promise.all([
    loadMessages(sb, id),
    sb
      .from("support_ticket_events")
      .select("id,from_status,to_status,actor_role,created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (messages.error) return c.json({ error: messages.error.message }, 500);
  if (events.error) return c.json({ error: events.error.message }, 500);
  return c.json({
    ticket,
    messages: messages.data ?? [],
    events: events.data ?? [],
  });
});

supportRouter.post("/tickets/:id/messages", async (c) => {
  const uid = c.get("userId");
  const id = c.req.param("id");
  const parsed = replySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Write a message first." }, 400);
  const sb = getSupabaseAdmin();
  const ticket = await loadOwnTicket(sb, uid, id);
  if (!ticket) return c.json({ error: "Ticket not found" }, 404);

  const inserted = await sb.from("support_messages").insert({
    ticket_id: id,
    author_role: "member",
    body: parsed.data.body,
  });
  if (inserted.error) return c.json({ error: inserted.error.message }, 500);

  const current = String(ticket.status ?? "open");
  const reopen = current === "waiting_on_you" || current === "resolved" || current === "closed";
  const next = reopen ? "open" : current;
  await sb
    .from("support_tickets")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("profile_id", uid);
  if (reopen) {
    await sb.from("support_ticket_events").insert({
      ticket_id: id,
      from_status: current,
      to_status: "open",
      actor_role: "member",
    });
  }
  return c.json({ ok: true, status: next });
});

async function loadMessages(sb: ReturnType<typeof getSupabaseAdmin>, ticketId: string) {
  const withPhotos = await sb
    .from("support_messages")
    .select("id,author_role,body,attachment_urls,created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (!withPhotos.error) return withPhotos;
  if (!withPhotos.error.message.includes("attachment_urls")) return withPhotos;
  return sb
    .from("support_messages")
    .select("id,author_role,body,created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
}

/** Photos must be this member's own support uploads. */
function ownSupportPhotos(uid: string, urls: string[]): string[] | null {
  const marker = `/report-screenshots/${uid}/support/`;
  const out: string[] = [];
  for (const url of urls) {
    let path = "";
    try {
      path = decodeURIComponent(new URL(url).pathname);
    } catch {
      return null;
    }
    if (!path.includes(marker) || path.includes("..")) return null;
    out.push(url);
  }
  return out;
}

async function loadOwnTicket(
  sb: ReturnType<typeof getSupabaseAdmin>,
  uid: string,
  id: string
) {
  const { data } = await sb
    .from("support_tickets")
    .select("id,ticket_number,subject,category,status,created_at,updated_at,profile_id")
    .eq("id", id)
    .eq("profile_id", uid)
    .maybeSingle();
  return data;
}
