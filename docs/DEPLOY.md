# Deploy: Supabase + Backend (Vercel) + Admin (Vercel)

Deploy **everything except the Flutter app**: database on **Supabase**, API on **Vercel**, admin on **Vercel**.

---

## 1. Supabase (database)

1. Create a project at [supabase.com](https://supabase.com/dashboard).

2. **SQL → New query** — run these files **in order**:
   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/0002_profile_sections.sql`

3. **Authentication → Providers** — enable **Phone** (SMS) and configure your SMS provider (Twilio, etc.), or use **Email** for testing.

4. **Project Settings → API** — copy:
   - **Project URL** → `SUPABASE_URL`
   - **Publishable key** (anon) → used by admin public env
   - **`service_role` secret** → **server-only** (never in Flutter)
   - **JWT Secret** → `SUPABASE_JWT_SECRET` (backend verifies user tokens)

5. **Storage** — ensure bucket `profile-photos` exists (migration `0001` inserts it). If the insert failed, create bucket `profile-photos` as **public** in the dashboard and keep the RLS policies from the migration.

6. Optional: **Settings → Data API** — default exposes `public` tables; our app uses the **service role** from backend/admin, so you’re fine once migrations ran.

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
| `ADMIN_DASHBOARD_SECRET` | long random string (you type this in the admin UI to unlock) |

**Security:** replace `ADMIN_DASHBOARD_SECRET` with real **admin auth** (e.g. Supabase Auth + `is_admin`) before production.

### Verify

Open `https://YOUR_ADMIN.vercel.app` — enter `ADMIN_DASHBOARD_SECRET`, then Reports / Users should load.

---

## 4. CORS

The API allows `origin: *`. For production you may restrict origins to your admin URL only (change `cors` in `backend/src/app.ts`).

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
- [ ] Vercel admin: root `admin`, env vars set, dashboard unlocks  
- [ ] `ADMIN_DASHBOARD_SECRET` is strong and stored only in Vercel
