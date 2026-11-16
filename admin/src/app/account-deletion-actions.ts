"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actionResult";
import {
  getAdminToken,
  getBackendUrl,
  requireAdminFeature,
} from "@/lib/admin-session-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type DeleteRequestRow = {
  ticket_id: string;
  ticket_number: number;
  profile_id: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  member_name: string | null;
  member_phone: string | null;
  member_email: string | null;
};

export type DeleteRequestDetail = {
  ticket: DeleteRequestRow;
  messages: {
    id: string;
    author_role: string;
    body: string;
    attachment_urls: string[];
    created_at: string;
  }[];
  profile: Record<string, unknown>;
  email: string | null;
  wallet: {
    contact_credits: number | null;
    premium_until: string | null;
  } | null;
  payments: {
    razorpay_payment_id: string;
    credits: number;
    amount_paise: number;
    created_at: string;
  }[];
  subscriptions: {
    id: string;
    plan_code: string;
    razorpay_subscription_id: string;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    created_at: string;
  }[];
  photo_urls: string[];
  selfie_url: string | null;
  govt_id_url: string | null;
};

function isDeleteAccountTicket(subject: string, category: string, body = ""): boolean {
  const hay = `${subject}\n${body}`.toLowerCase();
  if (!/delete|erase|remove\s+my\s+account|gdpr|close\s+my\s+account/.test(hay)) {
    return false;
  }
  return (
    category === "account" ||
    /delete(\s+my)?\s+(mangalam\s+)?account|account\s+deletion|erase\s+(my\s+)?(data|account)/.test(
      hay
    )
  );
}

async function memberEmail(profileId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin().auth.admin.getUserById(profileId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

export async function fetchDeleteAccountRequests(): Promise<ActionResult<DeleteRequestRow[]>> {
  const auth = await requireAdminFeature("support");
  if (!auth.ok) return auth;
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("support_tickets")
    .select("id,ticket_number,profile_id,subject,category,status,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(300);
  if (error) {
    return {
      ok: false,
      error: error.message.includes("support_tickets")
        ? `${error.message} Run supabase/migrations/0018_support_tickets.sql in the behlr SQL editor.`
        : error.message,
    };
  }

  const candidates = (data ?? []).filter((row) =>
    isDeleteAccountTicket(String(row.subject ?? ""), String(row.category ?? ""))
  );
  if (candidates.length === 0) return { ok: true, data: [] };

  const ids = [...new Set(candidates.map((row) => row.profile_id as string))];
  const { data: profiles } = await sb
    .from("profiles")
    .select("id,display_name,phone")
    .in("id", ids);
  const byId = new Map((profiles ?? []).map((row) => [row.id as string, row]));

  const emails = await Promise.all(ids.map(async (id) => [id, await memberEmail(id)] as const));
  const emailById = new Map(emails);

  return {
    ok: true,
    data: candidates.map((row) => {
      const member = byId.get(row.profile_id as string);
      return {
        ticket_id: row.id as string,
        ticket_number: Number(row.ticket_number),
        profile_id: row.profile_id as string,
        subject: row.subject as string,
        status: row.status as string,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        member_name: (member?.display_name as string | null) ?? null,
        member_phone: (member?.phone as string | null) ?? null,
        member_email: emailById.get(row.profile_id as string) ?? null,
      };
    }),
  };
}

export async function fetchDeleteAccountCase(
  ticketId: string
): Promise<ActionResult<DeleteRequestDetail>> {
  const auth = await requireAdminFeature("support");
  if (!auth.ok) return auth;
  const list = await fetchDeleteAccountRequests();
  if (!list.ok) return list;
  const ticket = list.data.find((row) => row.ticket_id === ticketId);
  if (!ticket) return { ok: false, error: "Delete request not found." };

  const sb = supabaseAdmin();
  const profileId = ticket.profile_id;

  const [messagesRes, profileRes, walletRes, paymentsRes, subsRes] = await Promise.all([
    (async () => {
      const withPhotos = await sb
        .from("support_messages")
        .select("id,author_role,body,attachment_urls,created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (!withPhotos.error || !withPhotos.error.message.includes("attachment_urls")) {
        return withPhotos;
      }
      return sb
        .from("support_messages")
        .select("id,author_role,body,created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
    })(),
    sb.from("profiles").select("*").eq("id", profileId).maybeSingle(),
    sb
      .from("wallets")
      .select("contact_credits,premium_until")
      .eq("profile_id", profileId)
      .maybeSingle(),
    sb
      .from("razorpay_payment_credits")
      .select("razorpay_payment_id,credits,amount_paise,created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(100),
    sb
      .from("member_subscriptions")
      .select(
        "id,plan_code,razorpay_subscription_id,status,current_period_end,cancel_at_period_end,created_at"
      )
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (messagesRes.error) return { ok: false, error: messagesRes.error.message };
  if (profileRes.error) return { ok: false, error: profileRes.error.message };
  if (!profileRes.data) return { ok: false, error: "Member profile was not found." };

  const profile = profileRes.data as Record<string, unknown>;
  const photos = Array.isArray(profile.photo_urls)
    ? (profile.photo_urls as unknown[]).map(String).filter((url) => url.startsWith("https://"))
    : [];

  return {
    ok: true,
    data: {
      ticket,
      messages: (messagesRes.data ?? []).map((row) => {
        const message = row as {
          id: string;
          author_role: string;
          body: string;
          created_at: string;
          attachment_urls?: string[] | null;
        };
        return {
          id: message.id,
          author_role: message.author_role,
          body: message.body,
          attachment_urls: Array.isArray(message.attachment_urls)
            ? message.attachment_urls
            : [],
          created_at: message.created_at,
        };
      }),
      profile,
      email: ticket.member_email,
      wallet: walletRes.data
        ? {
            contact_credits: (walletRes.data.contact_credits as number | null) ?? null,
            premium_until: (walletRes.data.premium_until as string | null) ?? null,
          }
        : null,
      payments: (paymentsRes.data ?? []).map((row) => ({
        razorpay_payment_id: row.razorpay_payment_id as string,
        credits: Number(row.credits ?? 0),
        amount_paise: Number(row.amount_paise ?? 0),
        created_at: row.created_at as string,
      })),
      subscriptions: (subsRes.data ?? []).map((row) => ({
        id: row.id as string,
        plan_code: row.plan_code as string,
        razorpay_subscription_id: row.razorpay_subscription_id as string,
        status: row.status as string,
        current_period_end: (row.current_period_end as string | null) ?? null,
        cancel_at_period_end: row.cancel_at_period_end === true,
        created_at: row.created_at as string,
      })),
      photo_urls: photos,
      selfie_url: typeof profile.selfie_url === "string" ? profile.selfie_url : null,
      govt_id_url: typeof profile.govt_id_url === "string" ? profile.govt_id_url : null,
    },
  };
}

export async function deleteMemberAccount(input: {
  profileId: string;
  ticketId: string;
  confirmEmail: string;
}): Promise<ActionResult<{ cancelled_subscriptions: string[] }>> {
  const auth = await requireAdminFeature("support");
  if (!auth.ok) return auth;

  const token = await getAdminToken();
  if (!token) return { ok: false, error: "No admin session" };

  const res = await fetch(
    `${getBackendUrl()}/v1/admin/users/${encodeURIComponent(input.profileId)}/delete-account`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        confirm_email: input.confirmEmail,
        ticket_id: input.ticketId,
      }),
      cache: "no-store",
    }
  );
  const data = (await res.json().catch(() => null)) as
    | { error?: string; cancelled_subscriptions?: string[] }
    | null;
  if (!res.ok) {
    return { ok: false, error: data?.error ?? `Delete failed (${res.status})` };
  }
  revalidatePath("/");
  return {
    ok: true,
    data: { cancelled_subscriptions: data?.cancelled_subscriptions ?? [] },
  };
}
