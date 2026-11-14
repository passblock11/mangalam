import { getSupabaseAdmin } from "./supabase.js";
import { contactCreditCosts, type CreditCosts } from "./public-profile.js";

let waiverColumnAvailable: boolean | null = null;

function isFemale(gender: unknown): boolean {
  return String(gender ?? "").trim().toLowerCase() === "female";
}

/** Admin switch: women receive paid membership benefits without a plan or credits. */
export async function femaleMembershipWaiverOn(): Promise<boolean> {
  if (waiverColumnAvailable === false) return false;
  const sb = getSupabaseAdmin();
  const res = await sb
    .from("app_settings")
    .select("female_membership_free")
    .eq("id", 1)
    .maybeSingle();
  if (res.error && /female_membership_free|column/i.test(res.error.message)) {
    waiverColumnAvailable = false;
    return false;
  }
  if (!res.data || !("female_membership_free" in res.data)) return false;
  waiverColumnAvailable = true;
  return res.data.female_membership_free === true;
}

/** True only for a female member while the admin switch is on. Men are unchanged. */
export async function femalePaidBenefitsWaived(profileId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("profiles")
    .select("gender")
    .eq("id", profileId)
    .maybeSingle();
  if (!isFemale(data?.gender)) return false;
  return femaleMembershipWaiverOn();
}

/**
 * Phone and WhatsApp of other members stay limited to verified members.
 * A paid plan is required unless this member is a woman and the admin
 * has turned membership off for women.
 */
export async function viewerCanSeeContact(viewerId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { data: viewer } = await sb
    .from("profiles")
    .select("is_verified,gender")
    .eq("id", viewerId)
    .maybeSingle();
  if (viewer?.is_verified !== true) return false;
  if (isFemale(viewer.gender) && (await femaleMembershipWaiverOn())) return true;

  const { data: wallet } = await sb
    .from("wallets")
    .select("premium_until")
    .eq("profile_id", viewerId)
    .maybeSingle();
  if (!wallet?.premium_until) return false;
  const until = new Date(wallet.premium_until as string).getTime();
  return Number.isFinite(until) && until > Date.now();
}

/** Purchased Premium versus the admin waiver for women. Add-ons need a real plan. */
export async function memberAccess(profileId: string): Promise<{
  active: boolean;
  waived: boolean;
  benefits: boolean;
  addonsAllowed: boolean;
}> {
  const sb = getSupabaseAdmin();
  const { data: wallet } = await sb
    .from("wallets")
    .select("premium_until")
    .eq("profile_id", profileId)
    .maybeSingle();
  const until = wallet?.premium_until ? new Date(wallet.premium_until as string).getTime() : 0;
  const active = Number.isFinite(until) && until > Date.now();
  const waived = await femalePaidBenefitsWaived(profileId);
  return {
    active,
    waived,
    benefits: active || waived,
    addonsAllowed: active,
  };
}

/** Phone and WhatsApp prices for this viewer. Waived women are not charged. */
export async function viewerContactCosts(viewerId: string): Promise<CreditCosts> {
  if (await femalePaidBenefitsWaived(viewerId)) return { phone: 0, whatsapp: 0 };
  return contactCreditCosts();
}
