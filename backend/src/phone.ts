/** Normalize to E.164. Default country India (+91) when digits-only. */
export function toE164(raw: string, defaultCountry = "91"): string | null {
  const trimmed = raw.trim().replace(/[\s\-()]/g, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) {
    const digits = `+${trimmed.slice(1).replace(/\D/g, "")}`;
    if (digits.length < 8) return null;
    return digits;
  }
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length < 10) return null;
  return `+${defaultCountry}${digitsOnly}`;
}

/** MSG91 expects mobile without +, e.g. 919876543210 */
export function toMsg91Mobile(e164: string): string {
  return e164.replace(/\D/g, "");
}

/** Stable internal email for magic-link session minting (phone-only users). */
export function phoneToLoginEmail(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  return `p_${digits}@phone.mangalam.app`;
}
