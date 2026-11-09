-- Idempotent ledger for Razorpay → wallet contact_credits (server-only via service role)

create table if not exists public.razorpay_payment_credits (
  razorpay_payment_id text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  credits int not null check (credits > 0),
  amount_paise int not null check (amount_paise > 0),
  created_at timestamptz not null default now()
);

alter table public.razorpay_payment_credits enable row level security;

-- No SELECT/INSERT policies for authenticated users; backend uses service role only.

comment on table public.razorpay_payment_credits is 'One row per successful Razorpay payment that credited contact_credits; prevents double-apply.';
