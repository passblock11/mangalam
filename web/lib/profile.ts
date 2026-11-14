export type Profile = {
  id?: string;
  display_name?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  city?: string | null;
  state?: string | null;
  religion?: string | null;
  community?: string | null;
  mother_tongue?: string | null;
  diet?: string | null;
  marital_status?: string | null;
  profile_for?: string | null;
  education_level?: string | null;
  occupation?: string | null;
  monthly_salary?: string | null;
  height_cm?: number | null;
  bio?: string | null;
  phone?: string | null;
  whatsapp_number?: string | null;
  photo_urls?: string[] | null;
  is_verified?: boolean;
  mangal_dosh?: string | null;
  birth_time?: string | null;
  birth_place?: string | null;
  age?: number | null;
  preferences?: Record<string, unknown> | null;
  partner_preferences?: Record<string, unknown> | null;
  app_language?: string | null;
  phone_visible?: boolean;
  photos_locked?: boolean;
  contact_locked?: boolean;
  contact_needs_verification?: boolean;
  phone_available?: boolean;
  whatsapp_available?: boolean;
  phone_revealed?: boolean;
  whatsapp_revealed?: boolean;
  phone_credit_cost?: number;
  whatsapp_credit_cost?: number;
  contact_owner_disabled?: boolean;
  verification_status?: string | null;
  verification_note?: string | null;
  email?: string | null;
};

export function profileReady(p: Profile | null | undefined): boolean {
  if (!p) return false;
  const photos = p.photo_urls;
  return Boolean(
    p.display_name?.trim() &&
      p.gender &&
      p.date_of_birth &&
      p.city?.trim() &&
      p.religion &&
      p.mother_tongue &&
      p.diet &&
      p.marital_status &&
      p.profile_for &&
      Array.isArray(photos) &&
      photos.length > 0,
  );
}

export function ageOf(dob?: string | null, fallback?: number | null): number | null {
  if (typeof fallback === "number" && Number.isFinite(fallback)) return fallback;
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}

export function inr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function preferenceText(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text || "All Ok";
}

export function photoOf(p: Profile | null | undefined): string | null {
  const url = p?.photo_urls?.[0];
  return url || null;
}
