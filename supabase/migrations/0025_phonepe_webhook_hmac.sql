-- PhonePe webhook HMAC secret (dashboard Authentication Type = HMAC).
-- SHA username/password columns from 0024 remain for Authentication Type = SHA.
-- Run once in the behlr SQL editor. Safe to run again.

alter table public.app_settings
  add column if not exists phonepe_sandbox_webhook_secret text,
  add column if not exists phonepe_live_webhook_secret text;

comment on column public.app_settings.phonepe_sandbox_webhook_secret is
  'PhonePe sandbox HMAC webhook secret from Developer Settings → Webhooks.';
comment on column public.app_settings.phonepe_live_webhook_secret is
  'PhonePe live HMAC webhook secret from Developer Settings → Webhooks.';
