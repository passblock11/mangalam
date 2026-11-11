-- 0009_admin_settings.sql
-- Admin-managed app settings: payment methods, plans, coupons, legal pages.
-- Run on behlr project (behlrsqilhzhniglhgqh).

-- ─────────────────────────────────────────────────────────────────────────────
-- App settings (singleton row, id=1)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.app_settings (
  id int primary key default 1,
  app_name text not null default 'Mangalam',
  tagline text,
  support_email text,
  support_phone text,
  support_whatsapp text,
  currency text not null default 'INR',
  active_payment_method text not null default 'razorpay',
  razorpay_key_id text,
  razorpay_key_secret text,
  razorpay_webhook_secret text,
  updated_at timestamptz not null default now(),
  check (id = 1)
);

insert into public.app_settings (id) values (1)
  on conflict (id) do nothing;

alter table public.app_settings enable row level security;
-- No SELECT policy → only service role can read (secrets live here).

-- ─────────────────────────────────────────────────────────────────────────────
-- Payment methods (only one active for collection at a time)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  provider text not null,                 -- 'razorpay' | 'upi' | 'manual' | 'stripe' | 'cashfree'
  display_name text not null,
  config jsonb not null default '{}'::jsonb,  -- provider-specific public config (key_id, upi_id, etc.)
  is_active boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_payment_methods_provider
  on public.payment_methods (provider);

alter table public.payment_methods enable row level security;
-- Public can read non-secret config (display_name, provider, is_active, sort_order, public config keys).
-- Secrets are never stored here — they live in app_settings (server-only) or env vars.
create policy "payment_methods_select_any"
  on public.payment_methods for select
  to anon, authenticated
  using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Plans (subscription / one-time / credits)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,              -- 'premium_monthly', 'credits_10', etc.
  name text not null,
  description text,
  plan_type text not null check (plan_type in ('subscription', 'one_time', 'credits')),
  price_paise int not null check (price_paise >= 0),
  credits int not null default 0,         -- contact credits granted
  duration_days int,                       -- premium duration for subscription/one_time
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_plans_active_sort
  on public.plans (is_active, sort_order);

alter table public.plans enable row level security;
create policy "plans_select_any"
  on public.plans for select
  to anon, authenticated
  using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Coupons
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percent', 'flat')),
  discount_value int not null check (discount_value >= 0),
  min_amount_paise int not null default 0,
  max_uses int,                            -- null = unlimited
  used_count int not null default 0,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_coupons_code
  on public.coupons (code);

alter table public.coupons enable row level security;
-- No SELECT policy → server-only (validation happens via backend with service role).

-- ─────────────────────────────────────────────────────────────────────────────
-- Legal pages (privacy, terms, refund, etc.) — admin-managed content
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.legal_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,               -- 'privacy' | 'terms' | 'refund' | 'about'
  title text not null,
  body text not null,
  version int not null default 1,
  is_published boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_legal_pages_slug
  on public.legal_pages (slug);

alter table public.legal_pages enable row level security;
create policy "legal_pages_select_published"
  on public.legal_pages for select
  to anon, authenticated
  using (is_published = true);

-- Seed default legal pages
insert into public.legal_pages (slug, title, body, is_published)
values
  ('privacy', 'Privacy Policy', E'# Privacy Policy\n\nMangalam ("we", "us") respects your privacy. This policy explains what we collect and how we use it.\n\n## Information we collect\n- Account details (name, email, phone) you provide during registration.\n- Profile information (community, location, photos, preferences).\n- Government ID and selfie for verification — stored privately and used only for manual review.\n\n## How we use it\n- To match and connect members.\n- To verify identity and keep the community safe.\n- To provide contact details to verified, paid members (only if you opt in).\n\n## Storage & retention\nPhotos and verification documents are stored securely. Verification documents are deleted after review where permitted by law.\n\n## Contact\nFor privacy questions, reach our support team.', true),
  ('terms', 'Terms of Service', E'# Terms of Service\n\nBy using Mangalam you agree to these terms.\n\n## Eligibility\nYou must be 18+ and legally able to marry.\n\n## Verification\nWe may require identity verification. Unverified members cannot view others'' contact details.\n\n## Conduct\nNo harassment, fraud, or misrepresentation. Violations may result in suspension.\n\n## Payments\nPremium plans and contact credits are non-refundable except where required by law.\n\n## Liability\nMangalam is a platform only. We do not guarantee matches and are not liable for member conduct.', true),
  ('refund', 'Refund & Cancellation', E'# Refund & Cancellation\n\n## Subscriptions\nPremium subscriptions can be cancelled to stop future renewals. The current period is non-refundable.\n\n## Contact credits\nCredit purchases are final once the payment is verified and credits are applied.\n\n## Verification fees\nVerification review fees (if any) are non-refundable.\n\n## Exceptions\nStatutory refund rights (where applicable) are honoured. Contact support with your payment ID.', true),
  ('about', 'About Mangalam', E'# About Mangalam\n\nMangalam is a modern matrimonial platform built on trust, verification, and community values.\n\nOur mission is to help people find meaningful, verified connections — safely and respectfully.\n\n## Why Mangalam?\n- Identity verification for every member.\n- Contact details shared only with verified, paid members — and only when you opt in.\n- Human-reviewed verification to keep the community genuine.', true)
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
