-- Cashfree credentials. Run once in the behlr SQL editor.
-- Secrets stay on app_settings, which has no public read policy.

alter table public.app_settings
  add column if not exists cashfree_client_id text,
  add column if not exists cashfree_client_secret text,
  add column if not exists cashfree_environment text not null default 'sandbox';

alter table public.app_settings
  drop constraint if exists app_settings_cashfree_environment_check;

alter table public.app_settings
  add constraint app_settings_cashfree_environment_check
  check (cashfree_environment in ('sandbox', 'production'));
