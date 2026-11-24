-- PhonePe Payment Gateway credentials (test + live).
-- Selected by active_payment_method = 'phonepe'.
-- Environment still follows integrations_live (off = test, on = live).
-- Run once in the behlr SQL editor. Safe to run again.
-- Secrets stay on app_settings (no public read).

alter table public.app_settings
  add column if not exists phonepe_sandbox_merchant_id text,
  add column if not exists phonepe_sandbox_client_id text,
  add column if not exists phonepe_sandbox_client_version text,
  add column if not exists phonepe_sandbox_client_secret text,
  add column if not exists phonepe_sandbox_webhook_username text,
  add column if not exists phonepe_sandbox_webhook_password text,
  add column if not exists phonepe_live_merchant_id text,
  add column if not exists phonepe_live_client_id text,
  add column if not exists phonepe_live_client_version text,
  add column if not exists phonepe_live_client_secret text,
  add column if not exists phonepe_live_webhook_username text,
  add column if not exists phonepe_live_webhook_password text;

comment on column public.app_settings.phonepe_sandbox_merchant_id is
  'PhonePe sandbox merchant id. Used when integrations_live is false.';
comment on column public.app_settings.phonepe_live_merchant_id is
  'PhonePe live merchant id. Used when integrations_live is true.';
