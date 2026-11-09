# MSG91 phone OTP (custom auth)

The mobile app **does not** use Supabase’s built-in phone SMS. OTP is sent via **MSG91** and verified on the **Mangalam API**. After verification the API mints a normal **Supabase session** (access + refresh tokens) for `/v1/*` calls.

## Flow

1. App → `POST /v1/auth/otp/send` `{ "phone": "9876543210" }`
2. API applies **rate limits** (no duplicate SMS if a valid OTP already exists).
3. API generates OTP, hashes it, calls [MSG91 Send OTP v5](https://control.msg91.com/api/v5/otp).
4. App → `POST /v1/auth/otp/verify` `{ "phone": "...", "otp": "123456" }`
5. API verifies hash, creates/finds user, returns Supabase `session` tokens; app calls `setSession(refresh_token)`.

Optional resend: `POST /v1/auth/otp/send` with `{ "phone": "...", "resend": true }` (cooldown + max resends per challenge).

## Cost controls (defaults)

| Variable | Default | Purpose |
|----------|---------|---------|
| `OTP_SEND_COOLDOWN_SEC` | 60 | Min gap between SMS to same number |
| `OTP_SEND_MAX_PER_HOUR` | 3 | Max successful SMS / hour / phone |
| `OTP_SEND_MAX_PER_DAY` | 10 | Max successful SMS / day / phone |
| `OTP_EXPIRY_MINUTES` | 5 | Short-lived codes |
| `OTP_MAX_RESENDS_PER_CHALLENGE` | 1 | Max extra SMS per login attempt |
| `OTP_MAX_VERIFY_ATTEMPTS` | 5 | Wrong guesses before new send |

Repeat **Send OTP** without resend while a code is still valid → **no new SMS** (`sms_sent: false`).

## MSG91 setup

1. [MSG91 dashboard](https://msg91.com) → get **Auth Key**.
2. Configure **OTP template** (India: DLT template ID) → set `MSG91_OTP_TEMPLATE_ID`.
3. **IP whitelist**: new keys often require your API server IP (Vercel egress IPs or use MSG91’s guidance).
4. Complete **KYC**; demo mode may not deliver real SMS content.

Reference: [MSG91 docs overview](https://docs.msg91.com/overview), Send OTP `POST https://control.msg91.com/api/v5/otp` with `authkey` header.

## Backend env (Vercel)

| Name | Required | Notes |
|------|----------|--------|
| `MSG91_AUTH_KEY` | Yes (prod) | Never in Flutter |
| `MSG91_OTP_TEMPLATE_ID` | Yes (India DLT) | Template variables must match dashboard |
| `MSG91_DEV_LOG_OTP` | Dev | `true` + missing key → log OTP, no SMS |

## Database

Run migration `supabase/migrations/0004_phone_otp_challenges.sql` (tables `phone_otp_challenges`, `phone_otp_send_log`).

## Local dev

```bash
cd backend
# .env: SUPABASE_* + MSG91_DEV_LOG_OTP=true (omit MSG91_AUTH_KEY to avoid SMS)
npm run dev
```

Watch terminal for `[dev] OTP for +91...`.
