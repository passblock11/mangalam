import { env } from "./env.js";
import { toMsg91Mobile } from "./phone.js";

export type Msg91SendResult =
  | { ok: true; requestId: string | null }
  | { ok: false; message: string };

type Msg91Json = {
  type?: string;
  message?: string;
  request_id?: string;
  code?: string;
};

const FLOW_URL = "https://control.msg91.com/api/v5/flow";
/** Dedicated transactional SMS (no Flow template / dashboard OTP setup). */
const SENDHTTP_URL = "https://control.msg91.com/api/sendhttp.php";

function authKey(): string | undefined {
  return env("MSG91_AUTH_KEY");
}

function flowHeaders(key: string): Record<string, string> {
  return {
    authkey: key,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
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
    (res.ok ? "MSG91 rejected send" : `MSG91 HTTP ${res.status}`);
  return { ok: false, message: msg };
}

/** Flow API — use when `MSG91_FLOW_TEMPLATE_ID` is set (DLT template in MSG91). */
async function sendViaFlowTemplate(
  key: string,
  mobile: string,
  otp: string,
  templateId: string
): Promise<Msg91SendResult> {
  const otpVar = env("MSG91_FLOW_OTP_VAR") ?? "VAR1";
  const recipients: Record<string, string> = {
    mobiles: mobile,
    [otpVar]: otp,
    // Common template aliases (case-sensitive per template — harmless if unused)
    VAR1: otp,
    VAR2: String(env("OTP_EXPIRY_MINUTES") ?? "5"),
    otp,
    OTP: otp,
  };

  const payload: Record<string, unknown> = {
    short_url: "0",
    realTimeResponse: "1",
    recipients: [recipients],
  };
  if (templateId) {
    payload.template_id = templateId;
  }

  const res = await fetch(FLOW_URL, {
    method: "POST",
    headers: flowHeaders(key),
    body: JSON.stringify(payload),
  });

  let data: Msg91Json = {};
  try {
    data = (await res.json()) as Msg91Json;
  } catch {
    return { ok: false, message: "Invalid response from MSG91 Flow" };
  }
  return parseMsg91Json(data, res);
}

/**
 * Transactional SMS via sendhttp — auth key only; message composed in our backend.
 * Matches MSG91 “dedicated SMS API” path (no Campaign, no SendOTP dashboard template).
 */
async function sendViaTransactionalHttp(
  key: string,
  mobile: string,
  otp: string,
  expiryMinutes: number
): Promise<Msg91SendResult> {
  const sender = env("MSG91_SENDER_ID") ?? "SMSIND";
  const text = `Your Mangalam login code is ${otp}. Valid for ${expiryMinutes} minutes. Do not share.`;
  const params = new URLSearchParams({
    authkey: key,
    mobiles: mobile,
    message: text,
    sender,
    route: "4",
    country: "91",
  });

  const res = await fetch(`${SENDHTTP_URL}?${params.toString()}`, {
    method: "GET",
  });
  const raw = (await res.text()).trim();

  if (!res.ok) {
    return { ok: false, message: raw || `MSG91 HTTP ${res.status}` };
  }

  // Success is typically a numeric message id; errors are often text starting with a code
  if (/^error|^invalid|^missing/i.test(raw)) {
    return { ok: false, message: raw };
  }
  return { ok: true, requestId: raw };
}

/**
 * Send login OTP SMS.
 *
 * Default (no dashboard): transactional sendhttp with `MSG91_AUTH_KEY` only.
 * Optional: `MSG91_FLOW_TEMPLATE_ID` → POST /api/v5/flow per MSG91 docs.
 */
export async function msg91SendOtp(
  phoneE164: string,
  otp: string,
  opts: { expiryMinutes: number }
): Promise<Msg91SendResult> {
  const key = authKey();
  if (!key) {
    if (env("MSG91_DEV_LOG_OTP") === "true") {
      return { ok: true, requestId: "dev" };
    }
    return { ok: false, message: "MSG91 is not configured" };
  }

  const mobile = toMsg91Mobile(phoneE164);
  const flowTemplate =
    env("MSG91_FLOW_TEMPLATE_ID") ?? env("MSG91_OTP_TEMPLATE_ID");

  if (flowTemplate) {
    return sendViaFlowTemplate(key, mobile, otp, flowTemplate);
  }

  const bareFlow = await sendViaFlowTemplate(key, mobile, otp, "");
  if (bareFlow.ok) return bareFlow;

  return sendViaTransactionalHttp(key, mobile, otp, opts.expiryMinutes);
}
