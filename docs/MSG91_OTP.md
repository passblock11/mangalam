# MSG91 phone OTP (Mangalam login)

Mobile login uses the **official MSG91 OTP API** ([docs](https://docs.msg91.com/llms.txt)):

| Step | Our API | MSG91 API |
|------|---------|-----------|
| Send / resend | `POST /v1/auth/otp/send` | `POST /api/v5/otp` or `GET /api/v5/otp/retry` |
| Verify | `POST /v1/auth/otp/verify` | `GET /api/v5/otp/verify` |
| Session | — | We mint Supabase session after MSG91 returns success |

MSG91 generates, stores, and checks the OTP. We keep **our** hourly/daily/cooldown limits in `phone_otp_send_log`.

## Required Vercel env (`mangalam-api`)

| Variable | Purpose |
|----------|---------|
| `MSG91_AUTH_KEY` | Auth key (header `authkey`) |
| `MSG91_OTP_TEMPLATE_ID` | Template from **OTP** section in MSG91 (must include `##OTP##`) |

OTP tuning: `OTP_LENGTH`, `OTP_EXPIRY_MINUTES`, `OTP_SEND_*`, etc.

## India DLT

Register the OTP template on TRAI DLT and map it in the MSG91 **OTP** section. Use that template id as `MSG91_OTP_TEMPLATE_ID`.

## App flow

1. `POST /v1/auth/otp/send` `{ "phone": "9876543210" }`
2. User enters SMS code
3. `POST /v1/auth/otp/verify` `{ "phone", "otp" }`
4. App `setSession` with returned Supabase tokens

Resend: `{ "resend": true }` → MSG91 Resend OTP (`retrytype=text`).

## CLI (no MCP in Cursor yet)

```bash
npx docstar-cli config set msg91 authkey '<key>'
npx docstar-cli msg91 otp sendotp --mobile 919876543210 --template_id '<id>' --otp_length 6 --otp_expiry 5
npx docstar-cli msg91 otp verify-otp --mobile 919876543210 --otp 123456
```

List modules: `npx docstar-cli list msg91`

Optional MCP in Cursor: add server `https://mcp.msg91.com/mcp` in Settings → MCP.

## Local dev

`MSG91_DEV_LOG_OTP=true` — skip real SendOTP/Verify (returns success without SMS).
