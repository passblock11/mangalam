import { getSupabaseAdmin } from "./supabase.js";
import { phoneToLoginEmail } from "./phone.js";

function isDuplicateUserError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("already") ||
    m.includes("registered") ||
    m.includes("exists") ||
    m.includes("duplicate")
  );
}

/** Create auth user if missing; mint refreshable Supabase session via admin magic-link OTP. */
export async function createSessionForPhone(
  phoneE164: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number; user_id: string }> {
  const sb = getSupabaseAdmin();
  const email = phoneToLoginEmail(phoneE164);

  const { data: existingProfile } = await sb
    .from("profiles")
    .select("id")
    .eq("phone", phoneE164)
    .maybeSingle();

  if (!existingProfile) {
    const { error: createErr } = await sb.auth.admin.createUser({
      email,
      email_confirm: true,
      phone: phoneE164,
      phone_confirm: true,
    });
    if (createErr && !isDuplicateUserError(createErr.message)) {
      throw new Error(createErr.message);
    }
  }

  const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw new Error(linkErr.message);

  const tokenHash = linkData.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error("Failed to generate auth token");
  }

  const { data: verifyData, error: verifyErr } = await sb.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });
  if (verifyErr) throw new Error(verifyErr.message);

  const session = verifyData.session;
  if (!session?.access_token || !session.refresh_token) {
    throw new Error("No session returned");
  }

  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in ?? 3600,
    user_id: session.user.id,
  };
}
