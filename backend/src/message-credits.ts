import { femalePaidBenefitsWaived } from "./contact-access.js";
import { getSupabaseAdmin } from "./supabase.js";

export type MessageBilling = {
  credit_cost: number;
  free_remaining: number;
  charge_replies: boolean;
  contact_credits: number;
  next_cost: number;
};

type Settings = {
  available: boolean;
  cost: number;
  freePerChat: number;
  chargeReplies: boolean;
};

let columnsAvailable: boolean | null = null;
let ledgerAvailable: boolean | null = null;

function clamp(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1000, Math.floor(n)));
}

async function loadSettings(): Promise<Settings> {
  if (columnsAvailable === false) {
    return { available: false, cost: 0, freePerChat: 0, chargeReplies: true };
  }
  const sb = getSupabaseAdmin();
  const res = await sb
    .from("app_settings")
    .select("message_credit_cost,message_free_per_chat,message_charge_replies")
    .eq("id", 1)
    .maybeSingle();
  if (res.error && /message_credit_cost|message_free_per_chat|message_charge_replies|column/i.test(res.error.message)) {
    columnsAvailable = false;
    return { available: false, cost: 0, freePerChat: 0, chargeReplies: true };
  }
  columnsAvailable = true;
  const row = (res.data ?? {}) as {
    message_credit_cost?: unknown;
    message_free_per_chat?: unknown;
    message_charge_replies?: unknown;
  };
  return {
    available: true,
    cost: clamp(row.message_credit_cost, 1),
    freePerChat: clamp(row.message_free_per_chat, 0),
    chargeReplies: row.message_charge_replies !== false,
  };
}

async function sentCount(conversationId: string, profileId: string): Promise<number> {
  const sb = getSupabaseAdmin();
  if (ledgerAvailable !== false) {
    const ledger = await sb
      .from("message_credit_charges")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
      .eq("profile_id", profileId);
    if (!ledger.error) {
      ledgerAvailable = true;
      return ledger.count ?? 0;
    }
    if (/message_credit_charges|relation|does not exist/i.test(ledger.error.message)) {
      ledgerAvailable = false;
    }
  }
  const messages = await sb
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("sender_id", profileId);
  return messages.count ?? 0;
}

/** The member who sent the first message. Replies stay free only for everyone else. */
async function starterId(conversationId: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (ledgerAvailable !== false) {
    const ledger = await sb
      .from("message_credit_charges")
      .select("profile_id")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!ledger.error) {
      ledgerAvailable = true;
      const id = ledger.data?.profile_id;
      return typeof id === "string" ? id : null;
    }
    if (/message_credit_charges|relation|does not exist/i.test(ledger.error.message)) {
      ledgerAvailable = false;
    }
  }
  const first = await sb
    .from("messages")
    .select("sender_id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const id = first.data?.sender_id;
  return typeof id === "string" ? id : null;
}

async function balanceOf(profileId: string): Promise<number | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("wallets")
    .select("contact_credits")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error || !data) return null;
  return Number(data.contact_credits ?? 0);
}

function nextCost(settings: Settings, sent: number, starter: string | null, profileId: string): number {
  if (!settings.available || settings.cost <= 0) return 0;
  if (!settings.chargeReplies && starter != null && starter !== profileId) return 0;
  if (sent < settings.freePerChat) return 0;
  return settings.cost;
}

export async function quoteMessage(
  profileId: string,
  conversationId: string
): Promise<MessageBilling | null> {
  if (await femalePaidBenefitsWaived(profileId)) {
    return {
      credit_cost: 0,
      free_remaining: 0,
      charge_replies: true,
      contact_credits: (await balanceOf(profileId)) ?? 0,
      next_cost: 0,
    };
  }
  const [settings, sent, starter, balance] = await Promise.all([
    loadSettings(),
    sentCount(conversationId, profileId),
    starterId(conversationId),
    balanceOf(profileId),
  ]);
  if (balance == null) return null;
  const replyIsFree =
    settings.available &&
    !settings.chargeReplies &&
    starter != null &&
    starter !== profileId;
  const cost = nextCost(settings, sent, starter, profileId);
  return {
    credit_cost: settings.available ? settings.cost : 0,
    free_remaining: replyIsFree ? 0 : Math.max(0, settings.freePerChat - sent),
    charge_replies: settings.chargeReplies,
    contact_credits: balance,
    next_cost: cost,
  };
}

async function spend(profileId: string, balance: number, cost: number): Promise<number | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("wallets")
    .update({
      contact_credits: balance - cost,
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", profileId)
    .eq("contact_credits", balance)
    .gte("contact_credits", cost)
    .select("contact_credits")
    .maybeSingle();
  if (error || !data) return null;
  return Number(data.contact_credits);
}

async function refund(profileId: string, cost: number): Promise<void> {
  const sb = getSupabaseAdmin();
  const current = await balanceOf(profileId);
  if (current == null) return;
  await sb
    .from("wallets")
    .update({
      contact_credits: current + cost,
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", profileId)
    .eq("contact_credits", current);
}

/**
 * Take the credits for one new message. The caller inserts the message
 * afterwards and then records it. A failed insert must call releaseMessageCharge.
 */
export async function reserveMessageCharge(
  profileId: string,
  conversationId: string
): Promise<
  | { ok: true; charged: number; billing: MessageBilling }
  | { ok: false; status: 402 | 500; error: string }
> {
  const billing = await quoteMessage(profileId, conversationId);
  if (!billing) {
    return { ok: false, status: 500, error: "Something went wrong on our end. Please try again." };
  }
  if (billing.next_cost <= 0) return { ok: true, charged: 0, billing };
  if (billing.next_cost > billing.contact_credits) {
    return { ok: false, status: 402, error: "Not enough contact credits." };
  }
  const remaining = await spend(profileId, billing.contact_credits, billing.next_cost);
  if (remaining == null) {
    return { ok: false, status: 402, error: "Not enough contact credits." };
  }
  return {
    ok: true,
    charged: billing.next_cost,
    billing: { ...billing, contact_credits: remaining, next_cost: 0 },
  };
}

export async function releaseMessageCharge(profileId: string, charged: number): Promise<void> {
  if (charged <= 0) return;
  await refund(profileId, charged);
}

/** Remember the send so the free allowance and the reply rule stay correct. */
export async function recordMessageCharge(
  profileId: string,
  conversationId: string,
  messageId: string,
  charged: number
): Promise<void> {
  if (ledgerAvailable === false) return;
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("message_credit_charges").insert({
    profile_id: profileId,
    conversation_id: conversationId,
    message_id: messageId,
    credits_charged: charged,
  });
  if (error && /message_credit_charges|relation|does not exist/i.test(error.message)) {
    ledgerAvailable = false;
  }
}

/** Billing for the next message, after this send has been recorded. */
export async function billingAfterSend(
  profileId: string,
  conversationId: string
): Promise<MessageBilling | null> {
  return quoteMessage(profileId, conversationId);
}
