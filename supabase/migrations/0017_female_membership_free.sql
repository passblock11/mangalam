-- Admin switch: women can use the app without a membership.
-- Verification, photos, and every other requirement stay in place.
-- Turn the column off later to ask women for a membership again.
-- Run once in the behlr SQL editor.

alter table public.app_settings
  add column if not exists female_membership_free boolean not null default true;
