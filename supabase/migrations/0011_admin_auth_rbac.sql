-- 0011_admin_auth_rbac.sql
-- Custom admin authentication (separate from app users) with feature-based RBAC.
-- Admins log in to the admin panel with email + password stored here (NOT Supabase Auth).

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,            -- pbkdf2$iterations$saltHex$hashHex
  full_name text,
  permissions jsonb not null default '{}'::jsonb,  -- {feature: bool}
  is_active boolean not null default true,
  is_super_admin boolean not null default false,   -- bypasses all permission checks
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admins_email on public.admins (email);

alter table public.admins enable row level security;
-- No SELECT/INSERT/UPDATE/DELETE policies → only service role can access.
-- The backend (Hono) uses the service role to verify credentials and issue JWTs.

comment on table public.admins is
  'Admin panel accounts (separate from app users). Backend verifies password and issues a JWT.';
comment on column public.admins.password_hash is
  'PBKDF2-SHA256 hash in format: pbkdf2$iterations$saltHex$hashHex';
comment on column public.admins.permissions is
  'JSON map of feature keys to booleans. Super admins bypass all checks.';
comment on column public.admins.is_super_admin is
  'If true, all feature permissions are granted regardless of the permissions JSON.';

notify pgrst, 'reload schema';
