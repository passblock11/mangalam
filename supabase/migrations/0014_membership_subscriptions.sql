-- Monthly membership (Razorpay Subscriptions / UPI Autopay).
-- Contact-credit packs stay one-time add-ons. Run this on behlr only.

alter table public.plans
  add column if not exists billing_period text not null default 'monthly';

alter table public.plans
  add column if not exists total_cycles int not null default 12;

alter table public.plans
  add column if not exists razorpay_plan_id text;

alter table public.plans
  add column if not exists razorpay_plan_key text;

alter table public.plans
  drop constraint if exists plans_billing_period_check;

alter table public.plans
  add constraint plans_billing_period_check
  check (billing_period in ('monthly', 'quarterly', 'yearly'));

alter table public.plans
  drop constraint if exists plans_total_cycles_check;

alter table public.plans
  add constraint plans_total_cycles_check
  check (total_cycles >= 1 and total_cycles <= 60);

comment on column public.plans.billing_period is
  'How often Razorpay charges a subscription plan.';
comment on column public.plans.total_cycles is
  'How many times the mandate can charge. UPI Autopay needs a fixed count. 12 monthly charges is one year.';
comment on column public.plans.razorpay_plan_id is
  'Razorpay plan id created by the API. Plans are immutable, so a price change creates a new id.';

create table if not exists public.member_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  plan_code text not null,
  razorpay_subscription_id text not null unique,
  razorpay_plan_id text,
  status text not null default 'created',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_member_subscriptions_profile
  on public.member_subscriptions (profile_id, created_at desc);

alter table public.member_subscriptions enable row level security;

insert into public.plans (
  code,
  name,
  description,
  plan_type,
  price_paise,
  credits,
  duration_days,
  billing_period,
  total_cycles,
  is_active,
  sort_order
)
values (
  'membership_monthly',
  'Monthly membership',
  'Renews every month by UPI or card. Cancel anytime and keep access until the date already paid.',
  'subscription',
  49900,
  0,
  30,
  'monthly',
  12,
  true,
  0
)
on conflict (code) do nothing;
