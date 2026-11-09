import { Hono } from "hono";
import { z } from "zod";
import { createSessionForPhone } from "../auth-session.js";
import { env } from "../env.js";
import { msg91SendOtp } from "../msg91.js";
import { generateOtp, hashOtp, timingSafeEqualHex } from "../otp-crypto.js";
import { toE164 } from "../phone.js";
import { getSupabaseAdmin } from "../supabase.js";

const sendSchema = z
  .object({
    phone: z.string().min(8).max(20),
    resend: z.boolean().optional(),
  })
  .strict();

const verifySchema = z
  .object({
    phone: z.string().min(8).max(20),
    otp: z.string().regex(/^\d{4,9}$/),
  })
  .strict();

function intEnv(name: string, fallback: number): number {
  const raw = env(name);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

const COOLDOWN_SEC = () => intEnv("OTP_SEND_COOLDOWN_SEC", 60);
const MAX_PER_HOUR = () => intEnv("OTP_SEND_MAX_PER_HOUR", 3);
const MAX_PER_DAY = () => intEnv("OTP_SEND_MAX_PER_DAY", 10);
const OTP_LENGTH = () => intEnv("OTP_LENGTH", 6);
const EXPIRY_MIN = () => intEnv("OTP_EXPIRY_MINUTES", 5);
const MAX_VERIFY = () => intEnv("OTP_MAX_VERIFY_ATTEMPTS", 5);
const MAX_RESENDS_PER_CHALLENGE = () => intEnv("OTP_MAX_RESENDS_PER_CHALLENGE", 1);

export const authRouter = new Hono();

authRouter.post("/otp/send", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const phone = toE164(parsed.data.phone);
  if (!phone) {
    return c.json({ error: "Invalid phone number" }, 400);
  }

  const sb = getSupabaseAdmin();
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const { count: hourCount } = await sb
    .from("phone_otp_send_log")
    .select("id", { count: "exact", head: true })
    .eq("phone_e164", phone)
    .eq("success", true)
    .gte("sent_at", hourAgo);

  if ((hourCount ?? 0) >= MAX_PER_HOUR()) {
    return c.json(
      { error: "Too many OTP requests. Try again in an hour." },
      429
    );
  }

  const { count: dayCount } = await sb
    .from("phone_otp_send_log")
    .select("id", { count: "exact", head: true })
    .eq("phone_e164", phone)
    .eq("success", true)
    .gte("sent_at", dayAgo);

  if ((dayCount ?? 0) >= MAX_PER_DAY()) {
    return c.json(
      { error: "Daily OTP limit reached. Try again tomorrow." },
      429
    );
  }

  const { data: active } = await sb
    .from("phone_otp_challenges")
    .select("*")
    .eq("phone_e164", phone)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .lt("attempts", MAX_VERIFY())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const wantResend = parsed.data.resend === true;

  if (active && !wantResend) {
    const retryMs = Math.max(
      0,
      COOLDOWN_SEC() * 1000 -
        (now - new Date(active.last_sent_at).getTime())
    );
    return c.json({
      ok: true,
      sms_sent: false,
      message:
        retryMs > 0
          ? "OTP already sent. Check your messages or wait before resending."
          : "OTP already active. Enter the code or resend.",
      retry_after_sec: Math.ceil(retryMs / 1000),
      expires_at: active.expires_at,
    });
  }

  if (active && wantResend) {
    const sinceLast =
      now - new Date(active.last_sent_at).getTime();
    if (sinceLast < COOLDOWN_SEC() * 1000) {
      return c.json(
        {
          error: "Wait before requesting another SMS.",
          retry_after_sec: Math.ceil(
            (COOLDOWN_SEC() * 1000 - sinceLast) / 1000
          ),
        },
        429
      );
    }
    if (active.send_count >= 1 + MAX_RESENDS_PER_CHALLENGE()) {
      return c.json(
        { error: "Resend limit reached for this OTP. Wait until it expires." },
        429
      );
    }
  }

  const otp = generateOtp(OTP_LENGTH());
  const otpHash = await hashOtp(phone, otp);
  const expiresAt = new Date(
    now + EXPIRY_MIN() * 60 * 1000
  ).toISOString();

  const templateId = env("MSG91_OTP_TEMPLATE_ID");
  const sendResult = await msg91SendOtp(phone, otp, {
    expiryMinutes: EXPIRY_MIN(),
    templateId,
  });

  const devLog = env("MSG91_DEV_LOG_OTP") === "true";
  if (devLog && sendResult.ok) {
    console.log(`[dev] OTP for ${phone}: ${otp}`);
  }

  if (!sendResult.ok) {
    await sb.from("phone_otp_send_log").insert({
      phone_e164: phone,
      success: false,
    });
    return c.json({ error: sendResult.message }, 502);
  }

  if (active && wantResend) {
    await sb
      .from("phone_otp_challenges")
      .update({
        otp_hash: otpHash,
        expires_at: expiresAt,
        last_sent_at: new Date().toISOString(),
        send_count: active.send_count + 1,
        attempts: 0,
      })
      .eq("id", active.id);
  } else {
    await sb.from("phone_otp_challenges").insert({
      phone_e164: phone,
      otp_hash: otpHash,
      expires_at: expiresAt,
      max_attempts: MAX_VERIFY(),
    });
  }

  await sb.from("phone_otp_send_log").insert({
    phone_e164: phone,
    success: true,
  });

  return c.json({
    ok: true,
    sms_sent: true,
    expires_in_sec: EXPIRY_MIN() * 60,
    otp_length: OTP_LENGTH(),
  });
});

authRouter.post("/otp/verify", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const phone = toE164(parsed.data.phone);
  if (!phone) {
    return c.json({ error: "Invalid phone number" }, 400);
  }

  const sb = getSupabaseAdmin();
  const { data: challenge } = await sb
    .from("phone_otp_challenges")
    .select("*")
    .eq("phone_e164", phone)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challenge) {
    return c.json({ error: "No active OTP. Request a new code." }, 400);
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return c.json({ error: "OTP expired. Request a new code." }, 400);
  }

  if (challenge.attempts >= challenge.max_attempts) {
    return c.json({ error: "Too many wrong attempts. Request a new code." }, 429);
  }

  const expectedHash = await hashOtp(phone, parsed.data.otp);
  const match = timingSafeEqualHex(expectedHash, challenge.otp_hash);

  await sb
    .from("phone_otp_challenges")
    .update({ attempts: challenge.attempts + 1 })
    .eq("id", challenge.id);

  if (!match) {
    const remaining = challenge.max_attempts - challenge.attempts - 1;
    return c.json(
      { error: "Invalid OTP.", attempts_remaining: Math.max(0, remaining) },
      401
    );
  }

  await sb
    .from("phone_otp_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", challenge.id);

  try {
    const session = await createSessionForPhone(phone);
    return c.json({ ok: true, session });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Session error";
    return c.json({ error: message }, 500);
  }
});
