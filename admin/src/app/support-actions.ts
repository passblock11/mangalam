"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ActionResult } from "@/lib/actionResult";
import { getAdminToken, getBackendUrl, requireAdminFeature } from "@/lib/admin-session-server";
import { revalidatePath } from "next/cache";

const STATUSES = ["open", "in_progress", "waiting_on_you", "resolved", "closed"] as const;
type TicketStatus = (typeof STATUSES)[number];

export type SupportTicketRow = {
  id: string;
  ticket_number: number;
  profile_id: string;
  subject: string;
  category: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  member_name: string | null;
  member_phone: string | null;
};

export type SupportTicketDetail = SupportTicketRow & {
  member_email: string | null;
  messages: {
    id: string;
    author_role: string;
    body: string;
    attachment_urls?: string[] | null;
    created_at: string;
  }[];
  events: {
    id: string;
    from_status: string | null;
    to_status: string;
    actor_role: string;
    created_at: string;
  }[];
};

function missingTable(message: string) {
  if (message.includes("attachment_urls")) {
    return `${message} Run supabase/migrations/0019_support_attachments.sql in the behlr SQL editor.`;
  }
  if (message.includes("support_tickets") || message.includes("support_messages")) {
    return `${message} Run supabase/migrations/0018_support_tickets.sql in the behlr SQL editor.`;
  }
  return message;
}

async function notifySupport(
  profileId: string,
  title: string,
  body: string,
  ticketId: string,
  status: string
) {
  const data = { ticket_id: ticketId, status };
  try {
    const token = await getAdminToken();
    if (token) {
      const res = await fetch(`${getBackendUrl()}/v1/admin/notify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profile_id: profileId,
          type: "support",
          title: title.slice(0, 120),
          body: body.slice(0, 400),
          data,
        }),
        cache: "no-store",
      });
      if (res.ok) return;
    }
  } catch {
    /* The in-app row below still records the update. */
  }
  try {
    await supabaseAdmin().from("notifications").insert({
      profile_id: profileId,
      type: "support",
      title: title.slice(0, 120),
      body: body.slice(0, 400),
      data,
    });
  } catch {
    /* The ticket update already succeeded. */
  }
}

function statusSentence(status: TicketStatus) {
  switch (status) {
    case "in_progress":
      return "Our team is working on your request.";
    case "waiting_on_you":
      return "We need a reply from you to continue.";
    case "resolved":
      return "Your request is resolved. Reply if you still need help.";
    case "closed":
      return "This request is closed. Reply if you need to reopen it.";
    default:
      return "Your request is open with our team.";
  }
}

export async function fetchSupportTickets(): Promise<ActionResult<SupportTicketRow[]>> {
  const auth = await requireAdminFeature("support");
  if (!auth.ok) return auth;
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("support_tickets")
    .select("id,ticket_number,profile_id,subject,category,status,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return { ok: false, error: missingTable(error.message) };
  const ids = [...new Set((data ?? []).map((row) => row.profile_id as string))];
  const { data: profiles } = ids.length
    ? await sb.from("profiles").select("id,display_name,phone").in("id", ids)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((row) => [row.id as string, row]));
  return {
    ok: true,
    data: (data ?? []).map((row) => {
      const member = byId.get(row.profile_id as string);
      return {
        id: row.id as string,
        ticket_number: Number(row.ticket_number),
        profile_id: row.profile_id as string,
        subject: row.subject as string,
        category: row.category as string,
        status: row.status as TicketStatus,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        member_name: (member?.display_name as string | null) ?? null,
        member_phone: (member?.phone as string | null) ?? null,
      };
    }),
  };
}

export async function fetchSupportTicket(
  ticketId: string
): Promise<ActionResult<SupportTicketDetail>> {
  const auth = await requireAdminFeature("support");
  if (!auth.ok) return auth;
  const list = await fetchSupportTickets();
  if (!list.ok) return list;
  const row = list.data.find((item) => item.id === ticketId);
  if (!row) return { ok: false, error: "Ticket not found" };
  const sb = supabaseAdmin();
  const [messages, events, user] = await Promise.all([
    (async () => {
      const withPhotos = await sb
        .from("support_messages")
        .select("id,author_role,body,attachment_urls,created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (!withPhotos.error || !withPhotos.error.message.includes("attachment_urls")) return withPhotos;
      return sb
        .from("support_messages")
        .select("id,author_role,body,created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
    })(),
    sb
      .from("support_ticket_events")
      .select("id,from_status,to_status,actor_role,created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
    sb.auth.admin.getUserById(row.profile_id),
  ]);
  if (messages.error) return { ok: false, error: missingTable(messages.error.message) };
  if (events.error) return { ok: false, error: missingTable(events.error.message) };
  return {
    ok: true,
    data: {
      ...row,
      member_email: user.data.user?.email ?? null,
      messages: (messages.data ?? []) as SupportTicketDetail["messages"],
      events: (events.data ?? []) as SupportTicketDetail["events"],
    },
  };
}

export async function updateSupportTicket(input: {
  ticketId: string;
  body?: string;
  status?: TicketStatus;
}): Promise<ActionResult<void>> {
  const auth = await requireAdminFeature("support");
  if (!auth.ok) return auth;
  const body = input.body?.trim() ?? "";
  const sb = supabaseAdmin();
  const { data: current, error } = await sb
    .from("support_tickets")
    .select("id,profile_id,status")
    .eq("id", input.ticketId)
    .maybeSingle();
  if (error) return { ok: false, error: missingTable(error.message) };
  if (!current) return { ok: false, error: "Ticket not found" };

  const fromStatus = current.status as TicketStatus;
  const nextStatus = input.status && STATUSES.includes(input.status) ? input.status : fromStatus;
  if (!body && nextStatus === fromStatus) {
    return { ok: false, error: "Write a reply or choose a new status." };
  }

  if (body) {
    const message = await sb.from("support_messages").insert({
      ticket_id: input.ticketId,
      author_role: "admin",
      body: body.slice(0, 2000),
    });
    if (message.error) return { ok: false, error: missingTable(message.error.message) };
  }

  const now = new Date().toISOString();
  const saved = await sb
    .from("support_tickets")
    .update({ status: nextStatus, updated_at: now })
    .eq("id", input.ticketId);
  if (saved.error) return { ok: false, error: missingTable(saved.error.message) };

  if (nextStatus !== fromStatus) {
    await sb.from("support_ticket_events").insert({
      ticket_id: input.ticketId,
      from_status: fromStatus,
      to_status: nextStatus,
      actor_role: "admin",
    });
  }

  const title = body ? "Support replied" : "Support update";
  const note = body ? body.slice(0, 180) : statusSentence(nextStatus);
  await notifySupport(current.profile_id as string, title, note, input.ticketId, nextStatus);
  revalidatePath("/");
  return { ok: true, data: undefined };
}
