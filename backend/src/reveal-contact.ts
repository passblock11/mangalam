import { getSupabaseAdmin } from "./supabase.js";
import { femalePaidBenefitsWaived, viewerCanSeeContact } from "./contact-access.js";
import { channelsRevealed, contactCreditCosts } from "./public-profile.js";

export type RevealBody = {
  channel: "phone" | "whatsapp";
  value?: string;
  credits_charged: number;
  contact_credits_remaining: number;
  needs_confirm?: boolean;
  credit_cost?: number;
};

export type RevealOutcome =
  | { ok: true; body: RevealBody }
  | { ok: false; status: 400 | 402 | 403 | 404 | 500; error: string };

/** Spend credits and return a phone or WhatsApp number the owner has shared. */
export async function revealContact(
  viewerId: string,
  targetId: string,
  channel: "phone" | "whatsapp",
  confirm: boolean
): Promise<RevealOutcome> {
  if (viewerId === targetId) {
    return { ok: false, status: 400, error: "Use your own profile for your number." };
  }

  const allowed = await viewerCanSeeContact(viewerId);
  if (!allowed) {
    return {
      ok: false,
      status: 403,
      error: "Phone numbers are shown only to verified members with an active premium plan.",
    };
  }

  const sb = getSupabaseAdmin();
  const { data: target, error: tErr } = await sb
    .from("profiles")
    .select("id,phone,whatsapp_number,phone_visible")
    .eq("id", targetId)
    .maybeSingle();
  if (tErr) return { ok: false, status: 500, error: tErr.message };
  if (!target) return { ok: false, status: 404, error: "Not found" };

  if (target.phone_visible !== true) {
    return {
      ok: false,
      status: 404,
      error: "This member has not shared a phone number. Ask them in chat.",
    };
  }

  const phone = String(target.phone ?? "").trim();
  const whatsapp = String(target.whatsapp_number ?? "").trim();
  const value = channel === "whatsapp" ? (whatsapp || phone) : phone;
  if (value.length < 8) {
    return {
      ok: false,
      status: 404,
      error: "This member has not shared a phone number. Ask them in chat.",
    };
  }

  const revealed = await channelsRevealed(viewerId, targetId);
  const costs = await contactCreditCosts();
  const waived = await femalePaidBenefitsWaived(viewerId);
  const listed = channel === "whatsapp" ? costs.whatsapp : costs.phone;
  const cost = waived ? 0 : listed;

  const { data: wallet, error: wErr } = await sb
    .from("wallets")
    .select("contact_credits")
    .eq("profile_id", viewerId)
    .maybeSingle();
  if ((wErr || !wallet) && cost > 0) {
    return { ok: false, status: 500, error: "Wallet not found" };
  }
  const balance = Number(wallet?.contact_credits ?? 0);

  if (revealed[channel]) {
    return {
      ok: true,
      body: {
        channel,
        value,
        credits_charged: 0,
        contact_credits_remaining: balance,
        credit_cost: cost,
      },
    };
  }

  if (!confirm && cost > 0) {
    return {
      ok: true,
      body: {
        channel,
        credits_charged: 0,
        contact_credits_remaining: balance,
        needs_confirm: true,
        credit_cost: cost,
      },
    };
  }

  if (cost > balance) {
    return { ok: false, status: 402, error: "Not enough contact credits." };
  }

  let remaining = balance;
  if (cost > 0) {
    const spent = await spendCredits(viewerId, balance, cost);
    if (spent == null) {
      return { ok: false, status: 402, error: "Not enough contact credits." };
    }
    remaining = spent;
  }

  const recorded = await recordReveal(viewerId, targetId, channel);
  if (!recorded.ok) {
    if (cost > 0) await refundCredits(viewerId, remaining, cost);
    return { ok: false, status: 500, error: recorded.error };
  }

  return {
    ok: true,
    body: {
      channel,
      value,
      credits_charged: cost,
      contact_credits_remaining: remaining,
      credit_cost: cost,
    },
  };
}

async function spendCredits(
  viewerId: string,
  balance: number,
  cost: number
): Promise<number | null> {
  const sb = getSupabaseAdmin();
  const next = balance - cost;
  const { data, error } = await sb
    .from("wallets")
    .update({
      contact_credits: next,
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", viewerId)
    .eq("contact_credits", balance)
    .gte("contact_credits", cost)
    .select("contact_credits")
    .maybeSingle();
  if (error || !data) return null;
  return Number(data.contact_credits);
}

async function refundCredits(viewerId: string, remaining: number, cost: number) {
  const sb = getSupabaseAdmin();
  await sb
    .from("wallets")
    .update({
      contact_credits: remaining + cost,
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", viewerId);
}

async function recordReveal(
  viewerId: string,
  targetId: string,
  channel: "phone" | "whatsapp"
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getSupabaseAdmin();
  const conversationId = await ensureConversation(viewerId, targetId);
  if (!conversationId) return { ok: false, error: "Could not record this contact view." };

  const withChannel = await sb.from("phone_reveals").insert({
    conversation_id: conversationId,
    revealer_id: viewerId,
    target_id: targetId,
    channel,
  });
  if (!withChannel.error) return { ok: true };
  if (!/channel|column/i.test(withChannel.error.message)) {
    return { ok: false, error: withChannel.error.message };
  }
  const legacy = await sb.from("phone_reveals").insert({
    conversation_id: conversationId,
    revealer_id: viewerId,
    target_id: targetId,
  });
  if (legacy.error) return { ok: false, error: legacy.error.message };
  return { ok: true };
}

async function ensureConversation(uid: string, other: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const { data: mine } = await sb
    .from("conversation_members")
    .select("conversation_id")
    .eq("profile_id", uid);
  const myConvs = [...new Set((mine ?? []).map((r) => r.conversation_id as string))];
  if (myConvs.length > 0) {
    const { data: rows } = await sb
      .from("conversation_members")
      .select("conversation_id,profile_id")
      .in("conversation_id", myConvs);
    const byConv = new Map<string, Set<string>>();
    for (const row of rows ?? []) {
      const id = String(row.conversation_id);
      if (!byConv.has(id)) byConv.set(id, new Set());
      byConv.get(id)!.add(String(row.profile_id));
    }
    for (const [cid, members] of byConv) {
      if (members.has(uid) && members.has(other)) return cid;
    }
  }

  const { data: conv, error } = await sb.from("conversations").insert({}).select("id").single();
  if (error || !conv) return null;
  const { error: mErr } = await sb.from("conversation_members").insert([
    { conversation_id: conv.id, profile_id: uid },
    { conversation_id: conv.id, profile_id: other },
  ]);
  if (mErr) return null;
  return conv.id as string;
}
