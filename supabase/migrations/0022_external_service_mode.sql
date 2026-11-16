-- One switch for every external service that has test and live credentials.
-- Off (false) uses the test pair. On (true) uses the live pair.
-- Secrets stay on app_settings, which has no public read policy.
-- Run once in the behlr SQL editor. Safe to run again.

alter table public.app_settings
  add column if not exists cashfree_client_id text,
  add column if not exists cashfree_client_secret text,
  add column if not exists cashfree_environment text not null default 'sandbox',
  add column if not exists integrations_live boolean not null default false,
  add column if not exists cashfree_sandbox_client_id text,
  add column if not exists cashfree_sandbox_client_secret text,
  add column if not exists cashfree_live_client_id text,
  add column if not exists cashfree_live_client_secret text,
  add column if not exists razorpay_test_key_id text,
  add column if not exists razorpay_test_key_secret text,
  add column if not exists razorpay_test_webhook_secret text,
  add column if not exists razorpay_live_key_id text,
  add column if not exists razorpay_live_key_secret text,
  add column if not exists razorpay_live_webhook_secret text;

alter table public.app_settings
  drop constraint if exists app_settings_cashfree_environment_check;

alter table public.app_settings
  add constraint app_settings_cashfree_environment_check
  check (cashfree_environment in ('sandbox', 'production'));

-- Copy the single saved pair into the matching slot. Does not overwrite a pair already saved.
update public.app_settings
set
  cashfree_live_client_id = coalesce(
    nullif(cashfree_live_client_id, ''),
    case when cashfree_environment = 'production' then nullif(cashfree_client_id, '') end
  ),
  cashfree_live_client_secret = coalesce(
    nullif(cashfree_live_client_secret, ''),
    case when cashfree_environment = 'production' then nullif(cashfree_client_secret, '') end
  ),
  cashfree_sandbox_client_id = coalesce(
    nullif(cashfree_sandbox_client_id, ''),
    case when cashfree_environment is distinct from 'production' then nullif(cashfree_client_id, '') end
  ),
  cashfree_sandbox_client_secret = coalesce(
    nullif(cashfree_sandbox_client_secret, ''),
    case when cashfree_environment is distinct from 'production' then nullif(cashfree_client_secret, '') end
  ),
  razorpay_live_key_id = coalesce(
    nullif(razorpay_live_key_id, ''),
    case when razorpay_key_id like 'rzp_live_%' then razorpay_key_id end
  ),
  razorpay_live_key_secret = coalesce(
    nullif(razorpay_live_key_secret, ''),
    case when razorpay_key_id like 'rzp_live_%' then nullif(razorpay_key_secret, '') end
  ),
  razorpay_live_webhook_secret = coalesce(
    nullif(razorpay_live_webhook_secret, ''),
    case when razorpay_key_id like 'rzp_live_%' then nullif(razorpay_webhook_secret, '') end
  ),
  razorpay_test_key_id = coalesce(
    nullif(razorpay_test_key_id, ''),
    case when razorpay_key_id is not null and razorpay_key_id not like 'rzp_live_%' then razorpay_key_id end
  ),
  razorpay_test_key_secret = coalesce(
    nullif(razorpay_test_key_secret, ''),
    case when razorpay_key_id is not null and razorpay_key_id not like 'rzp_live_%' then nullif(razorpay_key_secret, '') end
  ),
  razorpay_test_webhook_secret = coalesce(
    nullif(razorpay_test_webhook_secret, ''),
    case when razorpay_key_id is not null and razorpay_key_id not like 'rzp_live_%' then nullif(razorpay_webhook_secret, '') end
  )
where id = 1;
