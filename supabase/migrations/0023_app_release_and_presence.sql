-- 0023_app_release_and_presence.sql
-- Run once in the behlr SQL editor (behlrsqilhzhniglhgqh).
-- Adds the admin-controlled Android update gate and private chat presence.
-- Safe to re-run: new columns use IF NOT EXISTS, constraints are replaced.

alter table public.app_settings
  add column if not exists force_update_enabled boolean not null default false,
  add column if not exists android_min_version_code integer not null default 0,
  add column if not exists android_latest_version_name text not null default '',
  add column if not exists force_update_title text not null default 'Update Mangalam',
  add column if not exists force_update_message text not null default 'A new version of Mangalam is required to continue.',
  add column if not exists play_store_url text not null default 'https://play.google.com/store/apps/details?id=com.mangalam.matrimony';

alter table public.app_settings
  drop constraint if exists app_settings_android_min_version_code_check;
alter table public.app_settings
  add constraint app_settings_android_min_version_code_check
  check (android_min_version_code >= 0 and android_min_version_code <= 2100000000);

alter table public.app_settings
  drop constraint if exists app_settings_android_latest_version_name_check;
alter table public.app_settings
  add constraint app_settings_android_latest_version_name_check
  check (char_length(android_latest_version_name) <= 32);

alter table public.app_settings
  drop constraint if exists app_settings_force_update_title_check;
alter table public.app_settings
  add constraint app_settings_force_update_title_check
  check (char_length(force_update_title) between 1 and 80);

alter table public.app_settings
  drop constraint if exists app_settings_force_update_message_check;
alter table public.app_settings
  add constraint app_settings_force_update_message_check
  check (char_length(force_update_message) between 1 and 400);

alter table public.app_settings
  drop constraint if exists app_settings_play_store_url_check;
alter table public.app_settings
  add constraint app_settings_play_store_url_check
  check (char_length(play_store_url) between 1 and 300);

-- Private heartbeat. Not a column on profiles, so Discover never receives it.
create table if not exists public.member_presence (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  last_seen_at timestamptz not null
);

alter table public.member_presence enable row level security;
revoke all on table public.member_presence from public, anon, authenticated;
