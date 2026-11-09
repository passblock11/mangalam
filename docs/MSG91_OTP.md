# MSG91 phone OTP (custom auth)

The mobile app **does not** use Supabase’s built-in phone SMS. OTP is sent via **MSG91** and verified on the **Mangalam API**. After verification the API mints a normal **Supabase session** for `/v1/*` calls.

## App ↔ API flow

1. `POST /v1/auth/otp/send` `{ "phone": "9876543210" }`
2. API rate-limits, generates OTP, sends SMS via MSG91
3. `POST /v1/auth/otp/verify` `{ "phone": "...", "otp": "123456" }`
4. API checks hash, returns Supabase `session`; app calls `setSession(refresh_token)`

Resend: same endpoint with `{ "resend": true }` (cooldown applies).

## MSG91 send path (no dashboard OTP setup)

Production needs **`MSG91_AUTH_KEY` on Vercel only** (already set). No `MSG91_OTP_TEMPLATE_ID` required.

The API tries, in order:

1. **`POST https://control.msg91.com/api/v5/flow`** — [Flow / dedicated SMS API](https://docs.msg91.com/sms/send-sms) (optional `MSG91_FLOW_TEMPLATE_ID` if you add a template later)
2. **`sendhttp.php` transactional** — message text built in the backend (`route=4`, sender default `SMSIND`)

Verification stays on **our** API (not MSG91 Verify), so SMS cost stays controlled by our rate limits.

Optional (only if you create a Flow template later):

| Env | Purpose |
|-----|---------|
| `MSG91_FLOW_TEMPLATE_ID` | Force Flow with template |
| `MSG91_FLOW_OTP_VAR` | Template variable name (default `VAR1`) |
| `MSG91_SENDER_ID` | Override sender on sendhttp |

## Cost controls

| Variable | Default |
|----------|---------|
| `OTP_SEND_COOLDOWN_SEC` | 60 |
| `OTP_SEND_MAX_PER_HOUR` | 3 |
| `OTP_SEND_MAX_PER_DAY` | 10 |
| `OTP_EXPIRY_MINUTES` | 5 |
| `OTP_MAX_RESENDS_PER_CHALLENGE` | 1 |

## References

- [Configure SMS (help)](https://msg91.com/help/text-sms/step-by-step-process-to-configure-sms) — dedicated SMS / Flow, not Campaign, for this integration
- [Flow API](https://control.msg91.com/api/v5/flow)

## Local dev

```bash
MSG91_DEV_LOG_OTP=true   # logs OTP in terminal; no SMS
```
