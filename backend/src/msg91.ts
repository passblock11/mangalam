import { env } from "./env.js";
import { toMsg91Mobile } from "./phone.js";

export type Msg91SendResult =
  | { ok: true; requestId: string | null }
  | { ok: false; message: string };

export type Msg91VerifyResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

type Msg91Json = {
  type?: string;
  message?: string;
  request_id?: string;
  code?: string;
};

const CONTROL = "https://control.msg91.com";
const OTP_SEND_URL = `${CONTROL}/api/v5/otp`;
const OTP_VERIFY_URL = `${CONTROL}/api/v5/otp/verify`;
const OTP_RETRY_URL = `${CONTROL}/api/v5/otp/retry`;

function authKey(): string | undefined {
  return env("MSG91_AUTH_KEY");
}

function otpTemplateId(): string | undefined {
  return env("MSG91_OTP_TEMPLATE_ID");
}

function parseMsg91Json(data: Msg91Json, res: Response): Msg91SendResult {
  if (data.type === "success") {
    return {
      ok: true,
      requestId: data.request_id ?? data.message ?? null,
    };
  }
  const msg =
    data.message ??
    (res.ok ? "MSG91 rejected request" : `MSG91 HTTP ${res.status}`);
  return { ok: false, message: msg };
}

function parseVerifyJson(data: Msg91Json): Msg91VerifyResult {
  const msg = data.message ?? "OTP verification failed";
  if (data.type === "success") {
    return { ok: true, message: msg };
  }
  return { ok: false, message: msg };
}

/** MSG91 SendOTP — POST /api/v5/otp (MSG91 generates, stores, sends OTP). */
export async function msg91OtpSend(
  phoneE164: string,
  opts: { otpLength: number; otpExpiryMinutes: number }
): Promise<Msg91SendResult> {
  const key = authKey();
  if (!key) {
    if (env("MSG91_DEV_LOG_OTP") === "true") {
      return { ok: true, requestId: "dev" };
    }
    return { ok: false, message: "MSG91 is not configured" };
  }

  const templateId = otpTemplateId();
  if (!templateId) {
    return {
      ok: false,
      message:
        "Set MSG91_OTP_TEMPLATE_ID (OTP section template with ##OTP##) on the server.",
    };
  }

  const mobile = toMsg91Mobile(phoneE164);
  const params = new URLSearchParams({
    mobile,
    template_id: templateId,
    otp_length: String(Math.min(9, Math.max(4, opts.otpLength))),
    otp_expiry: String(Math.min(10080, Math.max(1, opts.otpExpiryMinutes))),
  });

  const res = await fetch(`${OTP_SEND_URL}?${params.toString()}`, {
    method: "POST",
    headers: {
      authkey: key,
      "content-type": "application/json",
    },
    body: "{}",
  });

  let data: Msg91Json = {};
  try {
    data = (await res.json()) as Msg91Json;
  } catch {
    return { ok: false, message: "Invalid response from MSG91 SendOTP" };
  }
  return parseMsg91Json(data, res);
}

/** MSG91 Verify OTP — GET /api/v5/otp/verify (check `type`, not only HTTP status). */
export async function msg91OtpVerify(
  phoneE164: string,
  otp: string
): Promise<Msg91VerifyResult> {
  const key = authKey();
  if (!key) {
    if (env("MSG91_DEV_LOG_OTP") === "true") {
      return { ok: true, message: "dev" };
    }
    return { ok: false, message: "MSG91 is not configured" };
  }

  const mobile = toMsg91Mobile(phoneE164);
  const params = new URLSearchParams({ mobile, otp });
  const res = await fetch(`${OTP_VERIFY_URL}?${params.toString()}`, {
    method: "GET",
    headers: { authkey: key },
  });

  let data: Msg91Json = {};
  try {
    data = (await res.json()) as Msg91Json;
  } catch {
    return { ok: false, message: "Invalid response from MSG91 Verify OTP" };
  }
  return parseVerifyJson(data);
}

/** MSG91 Resend OTP — GET /api/v5/otp/retry (`retrytype=text` or voice). */
export async function msg91OtpResend(
  phoneE164: string,
  retrytype: "text" | "voice" = "text"
): Promise<Msg91SendResult> {
  const key = authKey();
  if (!key) {
    return { ok: false, message: "MSG91 is not configured" };
  }

  const mobile = toMsg91Mobile(phoneE164);
  const params = new URLSearchParams({
    authkey: key,
    mobile,
    retrytype,
  });

  const res = await fetch(`${OTP_RETRY_URL}?${params.toString()}`, {
    method: "GET",
  });

  let data: Msg91Json = {};
  try {
    data = (await res.json()) as Msg91Json;
  } catch {
    return { ok: false, message: "Invalid response from MSG91 Resend OTP" };
  }
  return parseMsg91Json(data, res);
}
