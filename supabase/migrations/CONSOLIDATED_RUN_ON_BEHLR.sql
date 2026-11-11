-- ============================================================================
-- CONSOLIDATED MIGRATION — Run this in the Supabase SQL editor for project behlr
-- (behlrsqilhzhniglhgqh): https://supabase.com/dashboard/project/behlrsqilhzhniglhgqh/sql/new
--
-- This is idempotent (uses IF NOT EXISTS / ON CONFLICT) and combines:
--   0003 razorpay_payment_credits (with subscription support)
--   0007 profile_photos (photo_urls column + public bucket)
--   0008 verification_and_contacts (verification columns + private bucket)
--   0009 admin_settings (app_settings, payment_methods, plans, coupons, legal_pages)
--   0010 payment_ledger_subscription_support
--   0011 admin_auth_rbac (admins table)
-- ============================================================================

-- ─── 0003 + 0010: Razorpay payment ledger ───────────────────────────────────
create table if not exists public.razorpay_payment_credits (
  razorpay_payment_id text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  credits int not null check (credits >= 0),
  amount_paise int not null check (amount_paise > 0),
  premium_days int not null default 0,
  plan_code text,
  created_at timestamptz not null default now()
);
alter table public.razorpay_payment_credits enable row level security;
comment on table public.razorpay_payment_credits is 'One row per successful Razorpay payment that credited contact_credits or premium; prevents double-apply.';
comment on column public.razorpay_payment_credits.premium_days is 'Premium subscription days granted by this payment (0 for credit-only packs).';
comment on column public.razorpay_payment_credits.plan_code is 'Admin-managed plan code that this payment fulfilled, if any.';

-- ─── 0007: Profile photos ───────────────────────────────────────────────────
alter table public.profiles
  add column if not exists photo_urls text[] not null default '{}';

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

drop policy if exists "profile_photos_read" on storage.objects;
create policy "profile_photos_read"
  on storage.objects for select
  using (bucket_id = 'profile-photos');
drop policy if exists "profile_photos_insert_own" on storage.objects;
create policy "profile_photos_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos' and (string_to_array(name, '/'))[1] = auth.uid()::text);
drop policy if exists "profile_photos_update_own" on storage.objects;
create policy "profile_photos_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'profile-photos' and (string_to_array(name, '/'))[1] = auth.uid()::text);
drop policy if exists "profile_photos_delete_own" on storage.objects;
create policy "profile_photos_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile-photos' and (string_to_array(name, '/'))[1] = auth.uid()::text);

-- ─── 0008: Verification + contacts ───────────────────────────────────────────
alter table public.profiles add column if not exists whatsapp_number text;
alter table public.profiles add column if not exists verification_status text not null default 'none';
alter table public.profiles add column if not exists selfie_url text;
alter table public.profiles add column if not exists govt_id_url text;
alter table public.profiles add column if not exists verification_submitted_at timestamptz;
alter table public.profiles add column if not exists verification_reviewed_at timestamptz;
alter table public.profiles add column if not exists verification_note text;

create index if not exists idx_profiles_verification_status on public.profiles (verification_status);

insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

drop policy if exists "verif_docs_insert_own" on storage.objects;
create policy "verif_docs_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-docs' and (string_to_array(name, '/'))[1] = auth.uid()::text);
drop policy if exists "verif_docs_update_own" on storage.objects;
create policy "verif_docs_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'verification-docs' and (string_to_array(name, '/'))[1] = auth.uid()::text);
drop policy if exists "verif_docs_delete_own" on storage.objects;
create policy "verif_docs_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'verification-docs' and (string_to_array(name, '/'))[1] = auth.uid()::text);
drop policy if exists "verif_docs_read_admin" on storage.objects;
create policy "verif_docs_read_admin"
  on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
drop policy if exists "verif_docs_read_own" on storage.objects;
create policy "verif_docs_read_own"
  on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and (string_to_array(name, '/'))[1] = auth.uid()::text);

-- ─── 0009: Admin settings tables ─────────────────────────────────────────────
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
insert into public.app_settings (id) values (1) on conflict (id) do nothing;
alter table public.app_settings enable row level security;

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  display_name text not null,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_payment_methods_provider on public.payment_methods (provider);
alter table public.payment_methods enable row level security;
create policy "payment_methods_select_any"
  on public.payment_methods for select to anon, authenticated using (true);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  plan_type text not null check (plan_type in ('subscription', 'one_time', 'credits')),
  price_paise int not null check (price_paise >= 0),
  credits int not null default 0,
  duration_days int,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_plans_active_sort on public.plans (is_active, sort_order);
alter table public.plans enable row level security;
create policy "plans_select_any"
  on public.plans for select to anon, authenticated using (true);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percent', 'flat')),
  discount_value int not null check (discount_value >= 0),
  min_amount_paise int not null default 0,
  max_uses int,
  used_count int not null default 0,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_coupons_code on public.coupons (code);
alter table public.coupons enable row level security;

create table if not exists public.legal_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null,
  version int not null default 1,
  is_published boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_legal_pages_slug on public.legal_pages (slug);
alter table public.legal_pages enable row level security;
create policy "legal_pages_select_published"
  on public.legal_pages for select to anon, authenticated using (is_published = true);

insert into public.legal_pages (slug, title, body, is_published)
values
  ('privacy', 'Privacy Policy', E'# Privacy Policy\n\nMangalam ("we", "us") respects your privacy. This policy explains what we collect and how we use it.\n\n## Information we collect\n- Account details (name, email, phone) you provide during registration.\n- Profile information (community, location, photos, preferences).\n- Government ID and selfie for verification — stored privately and used only for manual review.\n\n## How we use it\n- To match and connect members.\n- To verify identity and keep the community safe.\n- To provide contact details to verified, paid members (only if you opt in).\n\n## Storage & retention\nPhotos and verification documents are stored securely. Verification documents are deleted after review where permitted by law.\n\n## Contact\nFor privacy questions, reach our support team.', true),
  ('terms', 'Terms of Service', E'# Terms of Service\n\nBy using Mangalam you agree to these terms.\n\n## Eligibility\nYou must be 18+ and legally able to marry.\n\n## Verification\nWe may require identity verification. Unverified members cannot view others'' contact details.\n\n## Conduct\nNo harassment, fraud, or misrepresentation. Violations may result in suspension.\n\n## Payments\nPremium plans and contact credits are non-refundable except where required by law.\n\n## Liability\nMangalam is a platform only. We do not guarantee matches and are not liable for member conduct.', true),
  ('refund', 'Refund & Cancellation', E'# Refund & Cancellation\n\n## Subscriptions\nPremium subscriptions can be cancelled to stop future renewals. The current period is non-refundable.\n\n## Contact credits\nCredit purchases are final once the payment is verified and credits are applied.\n\n## Verification fees\nVerification review fees (if any) are non-refundable.\n\n## Exceptions\nStatutory refund rights (where applicable) are honoured. Contact support with your payment ID.', true),
  ('about', 'About Mangalam', E'# About Mangalam\n\nMangalam is a modern matrimonial platform built on trust, verification, and community values.\n\nOur mission is to help people find meaningful, verified connections — safely and respectfully.\n\n## Why Mangalam?\n- Identity verification for every member.\n- Contact details shared only with verified, paid members — and only when you opt in.\n- Human-reviewed verification to keep the community genuine.', true)
on conflict (slug) do nothing;

-- ─── 0011: Admin auth + RBAC ─────────────────────────────────────────────────
create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  full_name text,
  permissions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  is_super_admin boolean not null default false,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_admins_email on public.admins (email);
alter table public.admins enable row level security;
comment on table public.admins is 'Admin panel accounts (separate from app users). Backend verifies password and issues a JWT.';
comment on column public.admins.password_hash is 'PBKDF2-SHA256 hash in format: pbkdf2$iterations$saltHex$hashHex';
comment on column public.admins.permissions is 'JSON map of feature keys to booleans. Super admins bypass all checks.';
comment on column public.admins.is_super_admin is 'If true, all feature permissions are granted regardless of the permissions JSON.';

-- ─── Reload PostgREST schema cache ──────────────────────────────────────────
notify pgrst, 'reload schema';
