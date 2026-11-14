import { getSupabaseAdmin } from "./supabase.js";

export type CreditCosts = { phone: number; whatsapp: number };

let costColumnsAvailable: boolean | null = null;
let revealChannelAvailable: boolean | null = null;

/** How many credits a phone or WhatsApp view costs. Admin-controlled. */
export async function contactCreditCosts(): Promise<CreditCosts> {
  const sb = getSupabaseAdmin();
  if (costColumnsAvailable !== false) {
    const res = await sb
      .from("app_settings")
      .select("phone_credit_cost,whatsapp_credit_cost")
      .eq("id", 1)
      .maybeSingle();
    if (!res.error && res.data) {
      costColumnsAvailable = true;
      return {
        phone: clampCost(res.data.phone_credit_cost),
        whatsapp: clampCost(res.data.whatsapp_credit_cost),
      };
    }
    if (res.error && /phone_credit_cost|whatsapp_credit_cost|column/i.test(res.error.message)) {
      costColumnsAvailable = false;
    }
  }
  return { phone: 1, whatsapp: 1 };
}

function clampCost(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(1000, Math.floor(n)));
}

export function photosAreShared(preferences: unknown): boolean {
  if (!preferences || typeof preferences !== "object") return true;
  return (preferences as { photos_visible?: unknown }).photos_visible !== false;
}

export type RevealedChannels = { phone: boolean; whatsapp: boolean };

/** Which contact channels this viewer has already paid for. */
export async function channelsRevealed(
  viewerId: string,
  targetId: string
): Promise<RevealedChannels> {
  const sb = getSupabaseAdmin();
  if (revealChannelAvailable !== false) {
    const res = await sb
      .from("phone_reveals")
      .select("channel")
      .eq("revealer_id", viewerId)
      .eq("target_id", targetId);
    if (!res.error) {
      revealChannelAvailable = true;
      const channels = new Set(
        (res.data ?? []).map((row) => String(row.channel ?? "phone"))
      );
      return {
        phone: channels.has("phone"),
        whatsapp: channels.has("whatsapp"),
      };
    }
    if (/channel|column/i.test(res.error.message)) {
      revealChannelAvailable = false;
    } else {
      return { phone: false, whatsapp: false };
    }
  }

  const legacy = await sb
    .from("phone_reveals")
    .select("id")
    .eq("revealer_id", viewerId)
    .eq("target_id", targetId)
    .limit(1);
  const any = (legacy.data ?? []).length > 0;
  return { phone: any, whatsapp: any };
}

/**
 * Shape sent to other members. Phone and WhatsApp numbers are included only
 * after this viewer has already spent credits. Email is never included.
 * When photo sharing is off, the same photos are still sent so the app can
 * draw them blurred. The clear photo is not opened from that screen.
 */
export function presentOtherMember(
  row: Record<string, unknown>,
  opts: {
    canAttemptContact: boolean;
    costs: CreditCosts;
    revealed?: RevealedChannels;
  }
): Record<string, unknown> {
  const revealed = opts.revealed ?? { phone: false, whatsapp: false };
  const phoneVisible = row.phone_visible === true;
  const phone = String(row.phone ?? "").trim();
  const whatsapp = String(row.whatsapp_number ?? "").trim();
  const sharedPhotos = photosAreShared(row.preferences);
  const photos = Array.isArray(row.photo_urls) ? row.photo_urls : [];

  const {
    phone: _phone,
    whatsapp_number: _wa,
    phone_visible: _pv,
    preferences: _prefs,
    email: _email,
    selfie_url: _selfie,
    govt_id_url: _govt,
    verification_status: _vs,
    ...rest
  } = row;

  const phoneOk = phoneVisible && phone.length >= 8;
  const whatsappOk = phoneVisible && (whatsapp.length >= 8 || phone.length >= 8);

  return {
    ...rest,
    photo_urls: photos,
    photos_locked: !sharedPhotos,
    phone: revealed.phone && phoneOk ? phone : null,
    whatsapp_number: revealed.whatsapp && whatsappOk ? (whatsapp || phone) : null,
    email: null,
    contact_locked: !opts.canAttemptContact,
    contact_owner_disabled: !phoneVisible,
    phone_available: phoneOk,
    whatsapp_available: whatsappOk,
    phone_revealed: revealed.phone && phoneOk,
    whatsapp_revealed: revealed.whatsapp && whatsappOk,
    phone_credit_cost: opts.costs.phone,
    whatsapp_credit_cost: opts.costs.whatsapp,
    contact_visible: false,
  };
}
