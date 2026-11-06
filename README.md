# Mangalam monorepo

Matrimony-style product: **Flutter** mobile app, **Node (TypeScript)** API on **Vercel**, **Supabase** (Postgres + Auth + Storage), and a **Next.js** admin web app on Vercel.

## Repo layout

| Folder | Purpose |
|--------|---------|
| `mobile/` | Flutter app (`mangalam_app`) |
| `backend/` | Hono API (`/v1/*`) for Vercel serverless |
| `admin/` | Next.js admin UI (moderation / ops) |
| `supabase/migrations/` | SQL migrations (run in Supabase SQL editor or CLI) |

## Prerequisites

- Flutter SDK (stable)
- Node 20+
- A Supabase project

## Environment variables

### Supabase (project settings)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only: backend + admin — never ship to the mobile app)

### JWT verification (backend)

The API verifies the caller’s **Supabase user JWT** (`Authorization: Bearer …`).

- `SUPABASE_JWT_SECRET` — copy from Supabase Dashboard → **Project Settings → API → JWT Secret** (used to verify access tokens with symmetric HS256).

### Flutter (`mobile/`)

Use **anon** key + URL only. Set via `--dart-define` or a `env` file you keep local:

```bash
flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
```

## Database

1. Open Supabase SQL editor and run `supabase/migrations/0001_initial_schema.sql`, then `supabase/migrations/0002_profile_sections.sql` (adds occupation, astrology, `partner_preferences`, `last_active_at`).
2. Enable **Phone** auth (or Email) in Supabase Auth as you prefer.
3. Create a **public** Storage bucket `profile-photos` (or adjust migration policies).

Row Level Security (RLS) is enabled on all public tables. The **backend** uses the service role for cross-user operations (e.g. match feed) so business rules stay consistent.

## Local development

### Backend

```bash
cd backend
cp .env.example .env   # fill values
npm run dev
# listens on http://localhost:3001
```

### Admin

```bash
cd admin
cp .env.local.example .env.local
npm run dev
```

### Mobile

```bash
cd mobile
flutter pub get
flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
```

## Deploying to Vercel

**Step-by-step:** see [`docs/DEPLOY.md`](docs/DEPLOY.md) (Supabase migrations, env vars, two Vercel projects).

Summary:

- Deploy **`backend/`** and **`admin/`** as **two separate Vercel projects** (set **Root Directory** to each folder).
- Backend: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`.
- Admin: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — sign in with Supabase **email/password**; promote the user with `profiles.is_admin = true` (see `docs/DEPLOY.md`).

Point the Flutter app to the deployed API (`API_BASE_URL`).

## API overview (`/v1`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/v1/health` | — | Liveness |
| GET | `/v1/me` | User JWT | Current profile + wallet |
| PATCH | `/v1/me` | User JWT | Update own profile |
| GET | `/v1/matches` | User JWT | Discovery (`?tab=all`) or shortlisted (`?tab=shortlist`) |
| POST | `/v1/interactions` | User JWT | like / pass / shortlist |
| GET | `/v1/likes` | User JWT | `tab=mutual|views|contacts` — ages computed; **contacts** = people you messaged first |
| GET | `/v1/conversations` | User JWT | List threads (`?folder=primary` inbox vs `sent`) |
| POST | `/v1/conversations` | User JWT | Start thread (after mutual like); optional `first_message` |
| GET | `/v1/profiles/:id` | User JWT | View another member (logs profile view) |
| POST | `/v1/blocks` | User JWT | Block a profile |
| GET | `/v1/conversations/:id/messages` | User JWT | Messages |
| POST | `/v1/conversations/:id/messages` | User JWT | Send message |
| POST | `/v1/conversations/:id/reveal-phone` | User JWT | Spend contact credit, reveal phone |
| POST | `/v1/reports` | User JWT | Report a profile |
| POST | `/v1/views` | User JWT | Record a profile view (for “Views” tab) |

Admin moderation uses the admin Next app (service role) — replace the shared secret with **Supabase Auth** + `profiles.is_admin` before production.

## Feature coverage (wired in repo)

| Feature | Mobile | API | Admin |
|--------|--------|-----|--------|
| Phone OTP (Supabase) | Yes | — | — |
| Discover + Shortlist | Yes | Yes | — |
| Like / Pass / Shortlist | Yes | Yes | — |
| Profile detail, report, block | Yes | Yes | Reports list |
| Likes: Matches / Views / Contacts | Yes | Yes | — |
| Messages Primary / Sent + chat | Yes | Yes | — |
| Reveal phone (wallet credits) | Yes | Yes | Set credits + verify |
| Edit profile | Yes | Yes | User search |

**Not implemented in code (add when you need them):** in-app payments (Razorpay/Play Billing), push notifications, biodata PDF export, photo upload UI to Storage, real admin sign-in (use `is_admin` + Supabase Auth).

---

**Security note:** Never commit real `.env` files. The service role key is equivalent to database root for your project.
