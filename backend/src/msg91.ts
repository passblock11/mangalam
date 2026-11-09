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

function authKey(): string | undefined {
  return env("MSG91_AUTH_KEY");
}

/**
 * Send OTP SMS via MSG91 v5 OTP API.
 * @see https://control.msg91.com/api/v5/otp
 * We pass a server-generated `otp` so verification stays on our API (no extra MSG91 verify call).
 */
export async function msg91SendOtp(
  phoneE164: string,
  otp: string,
  opts: { expiryMinutes: number; templateId?: string }
): Promise<Msg91SendResult> {
  const key = authKey();
  if (!key) {
    if (env("MSG91_DEV_LOG_OTP") === "true") {
      return { ok: true, requestId: "dev" };
    }
    return { ok: false, message: "MSG91 is not configured" };
  }

  const mobile = toMsg91Mobile(phoneE164);
  const params = new URLSearchParams({
    mobile,
    otp,
    otp_length: String(otp.length),
    otp_expiry: String(opts.expiryMinutes),
    unicode: "0",
    realTimeResponse: "1",
  });
  if (opts.templateId) {
    params.set("template_id", opts.templateId);
  }

  const res = await fetch(`https://control.msg91.com/api/v5/otp?${params.toString()}`, {
    method: "POST",
    headers: {
      authkey: key,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  let data: Msg91Json = {};
  try {
    data = (await res.json()) as Msg91Json;
  } catch {
    return { ok: false, message: "Invalid response from MSG91" };
  }

  if (data.type === "success") {
    return { ok: true, requestId: data.request_id ?? null };
  }

  const msg =
    data.message ??
    (res.ok ? "MSG91 rejected send" : `MSG91 HTTP ${res.status}`);
  return { ok: false, message: msg };
}
