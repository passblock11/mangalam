# Deploy: Supabase + Backend (Vercel) + Admin (Vercel)

Deploy **everything except the Flutter app**: database on **Supabase**, API on **Vercel**, admin on **Vercel**.

### Security

- **Never commit** API keys, JWT secrets, or database passwords. Keep them in **Vercel** (or local `.env` ignored by git) only.
- If credentials were pasted into chat, a ticket, or a public channel, **rotate them in Supabase** (Database Settings → reset DB password; Project Settings → API → rotate JWT secret and regenerate service role / anon keys as needed).

---

## 1. Supabase (database)

1. Create a project at [supabase.com](https://supabase.com/dashboard).

2. **SQL → New query** — run these files **in order**:
   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/0002_profile_sections.sql`
   - `supabase/migrations/0003_razorpay_payment_credits.sql` (Razorpay wallet top-ups — idempotency ledger)
   - `supabase/migrations/0004_phone_otp_challenges.sql` (MSG91 OTP rate limits)

   **Alternative (local script):** from the repo root, with **Node** and `backend` dependencies installed (`cd backend && npm ci`):

```bash
export SUPABASE_DB_URL='postgres://postgres.YOUR_PROJECT_REF:YOUR_DB_PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres'
node scripts/run-supabase-migrations.mjs
```

Use the **Session pooler** connection string from Supabase → **Project Settings → Database** (port **5432**, not 6543). **Never commit** the URL or password.

3. **Authentication → Providers**
   - **Email** — enable (required for the admin panel).
   - **Phone** — optional; the **Flutter app uses custom MSG91 OTP** via the API (`/v1/auth/otp/*`), not Supabase SMS. You can leave Supabase Phone **disabled** to avoid double billing.

4. **Project Settings → API** — copy values into Vercel using the **exact names below** (not generic “Supabase export” names):
   - **Project URL** → `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
   - **anon** / **publishable** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (admin only; safe to expose to the browser)
   - **`service_role`** → `SUPABASE_SERVICE_ROLE_KEY` (**server-only** on backend + admin; never in Flutter or public env)
   - **JWT Secret** → `SUPABASE_JWT_SECRET` (**backend only**; verifies user JWTs)

   This repo does **not** read Prisma-style `POSTGRES_*` or `POSTGRES_URL` variables; use those only if you add your own tooling. The app talks to Supabase via **HTTPS + Supabase keys**, not direct Postgres from the Edge API.

5. **Storage** — ensure bucket `profile-photos` exists (migration `0001` inserts it). If the insert failed, create bucket `profile-photos` as **public** in the dashboard and keep the RLS policies from the migration.

6. Optional: **Settings → Data API** — default exposes `public` tables; our app uses the **service role** from backend/admin, so you’re fine once migrations ran.

**Same project everywhere:** The host in **`SUPABASE_URL`** / **`NEXT_PUBLIC_SUPABASE_URL`** on Vercel must be **this** Supabase project (e.g. `https://YOUR_REF.supabase.co`). If the API/admin point at a different ref than the project where you ran SQL, you’ll get errors like **“Could not find the table `public.reports`”** — run the migrations on the project that matches those URLs, or update Vercel to match the project that already has the schema.

---

## 2. Backend API on Vercel

**Monorepo note:** create a **separate Vercel project** and set **Root Directory** to `backend`.

### Import

1. Vercel → **Add New… → Project** → import your Git repo.
2. **Root Directory:** `backend`
3. **Framework Preset:** Other (or leave auto-detect).
4. **Build Command:** `npm run vercel-build` (or empty; default `npm run build` runs `tsc --noEmit` which is fine).
5. **Output:** default (serverless/edge picks up `api/`).

### Environment variables (Production)

| Name | Value |
|------|--------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (secret) |
| `SUPABASE_JWT_SECRET` | JWT Secret from Supabase API settings |
| `RAZORPAY_KEY_ID` | Razorpay **Key Id** (Dashboard → API Keys) |
| `RAZORPAY_KEY_SECRET` | Razorpay **Key Secret** (server-only) |
| `CONTACT_CREDIT_PRICE_PAISE` | *(optional)* Paise per contact credit; default `100` (₹1/credit) |
| `MSG91_AUTH_KEY` | MSG91 Auth Key (required for SMS) |
| `MSG91_FLOW_TEMPLATE_ID` | *(optional)* Flow template — omit for sendhttp fallback |
| `MSG91_DEV_LOG_OTP` | `true` on preview/dev to log OTP without SMS |
| `OTP_*` | *(optional)* Rate limits — see [`docs/MSG91_OTP.md`](MSG91_OTP.md) |

### How routing works

- `vercel.json` rewrites `/*` → `/api/*`, so **`https://your-api.vercel.app/v1/health`** hits the Edge handler.

### Verify after deploy

```bash
curl https://YOUR_BACKEND.vercel.app/v1/health
```

Expect: `{"ok":true,"service":"mangalam-api"}`.

---

## 3. Admin panel on Vercel

**Second Vercel project** — **Root Directory:** `admin`.

### Import

1. **Root Directory:** `admin`
2. **Framework Preset:** Next.js (auto).
3. **Build:** default `next build`.

### Environment variables (Production)

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | same as `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | same service role as backend |

### Admin sign-in (email + password)

1. In Supabase → **Authentication → Providers** → **Email** — turn it on (you can relax “Confirm email” for a test admin only).
2. **Create the admin user**: **Authentication → Users** → **Add user** (set email + password).
3. Promote that user in **SQL**:

```sql
update public.profiles
set is_admin = true
where id = 'PASTE-THE-USER-UUID-HERE';
```

Use the user id from **Authentication → Users**. A `profiles` row is created when the user is created (`0001` trigger).

4. Open `https://YOUR_ADMIN.vercel.app` — sign in with that email and password.

If the dashboard errors about **`public.reports`** (or another missing table), run **`0001`** then **`0002`** in the SQL editor for this project (step 1 above).

**Legacy:** delete `ADMIN_DASHBOARD_SECRET` from Vercel if it was set — the app no longer uses it.

---

## 4. CORS

The API allows `origin: *`. For production you may restrict origins to your admin URL only (change `cors` in `backend/src/honoApp.ts`).

---

## 5. Flutter (later, not part of this deploy)

Point the app at:

- `API_BASE_URL=https://YOUR_BACKEND.vercel.app`
- `SUPABASE_URL` + publishable key as today

---

## Quick checklist

- [ ] Supabase: both SQL migrations applied  
- [ ] Supabase: Auth provider (phone/email) configured  
- [ ] Vercel backend: root `backend`, env vars set, `/v1/health` OK  
- [ ] Vercel admin: root `admin`, env vars set; admin user has `profiles.is_admin = true`  
- [ ] Admin can sign in with email/password at `YOUR_ADMIN.vercel.app`
