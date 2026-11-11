-- Allow zero-credit rows for pure subscription plans (premium_days only).
-- Previously credits had to be > 0; subscription plans grant 0 credits but premium_days.

alter table public.razorpay_payment_credits
  drop constraint if exists razorpay_payment_credits_credits_check;

alter table public.razorpay_payment_credits
  add constraint razorpay_payment_credits_credits_check check (credits >= 0);

-- Track premium_days + plan_code on the ledger for auditability.
alter table public.razorpay_payment_credits
  add column if not exists premium_days int not null default 0;

alter table public.razorpay_payment_credits
  add column if not exists plan_code text;

comment on column public.razorpay_payment_credits.premium_days is
  'Premium subscription days granted by this payment (0 for credit-only packs).';
comment on column public.razorpay_payment_credits.plan_code is
  'Admin-managed plan code that this payment fulfilled, if any.';
