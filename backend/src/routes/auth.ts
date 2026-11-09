import { Hono } from "hono";
import { z } from "zod";
import { createSessionForPhone } from "../auth-session.js";
import { env } from "../env.js";
import { msg91OtpResend, msg91OtpSend, msg91OtpVerify } from "../msg91.js";
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

  const { data: lastSend } = await sb
    .from("phone_otp_send_log")
    .select("sent_at")
    .eq("phone_e164", phone)
    .eq("success", true)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const wantResend = parsed.data.resend === true;
  const lastSentAt = lastSend?.sent_at
    ? new Date(lastSend.sent_at).getTime()
    : 0;
  const sinceLastMs = lastSentAt > 0 ? now - lastSentAt : Number.POSITIVE_INFINITY;

  if (!wantResend && sinceLastMs < EXPIRY_MIN() * 60 * 1000) {
    const retryMs = Math.max(
      0,
      COOLDOWN_SEC() * 1000 - sinceLastMs
    );
    return c.json({
      ok: true,
      sms_sent: false,
      message:
        retryMs > 0
          ? "OTP already sent. Check your messages or wait before resending."
          : "OTP already active. Enter the code or resend.",
      retry_after_sec: Math.ceil(retryMs / 1000),
      expires_in_sec: EXPIRY_MIN() * 60,
    });
  }

  if (wantResend && sinceLastMs < COOLDOWN_SEC() * 1000) {
    return c.json(
      {
        error: "Wait before requesting another SMS.",
        retry_after_sec: Math.ceil(
          (COOLDOWN_SEC() * 1000 - sinceLastMs) / 1000
        ),
      },
      429
    );
  }

  const sendResult = wantResend
    ? await msg91OtpResend(phone, "text")
    : await msg91OtpSend(phone, {
        otpLength: OTP_LENGTH(),
        otpExpiryMinutes: EXPIRY_MIN(),
      });

  if (!sendResult.ok) {
    await sb.from("phone_otp_send_log").insert({
      phone_e164: phone,
      success: false,
    });
    return c.json({ error: sendResult.message }, 502);
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
    provider: "msg91_otp",
    provider_request_id: sendResult.requestId,
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

  const verifyResult = await msg91OtpVerify(phone, parsed.data.otp);
  if (!verifyResult.ok) {
    const msg = verifyResult.message.toLowerCase();
    const status = msg.includes("expired") ? 400 : 401;
    return c.json({ error: verifyResult.message }, status);
  }

  try {
    const session = await createSessionForPhone(phone);
    return c.json({ ok: true, session });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Session error";
    return c.json({ error: message }, 500);
  }
});
