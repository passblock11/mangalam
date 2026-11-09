-- Custom phone OTP (MSG91 transport). Server-only via service role.

create table if not exists public.phone_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  max_attempts int not null default 5,
  consumed_at timestamptz,
  send_count int not null default 1,
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_phone_otp_challenges_phone_created
  on public.phone_otp_challenges (phone_e164, created_at desc);

create table if not exists public.phone_otp_send_log (
  id bigserial primary key,
  phone_e164 text not null,
  sent_at timestamptz not null default now(),
  provider text not null default 'msg91',
  success boolean not null
);

create index if not exists idx_phone_otp_send_log_phone_sent
  on public.phone_otp_send_log (phone_e164, sent_at desc);

alter table public.phone_otp_challenges enable row level security;
alter table public.phone_otp_send_log enable row level security;

comment on table public.phone_otp_challenges is 'Active OTP challenges; no client access.';
comment on table public.phone_otp_send_log is 'SMS send audit for rate limiting and cost control.';
