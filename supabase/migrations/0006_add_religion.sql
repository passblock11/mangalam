-- Add religion column to profiles for onboarding.
alter table public.profiles
  add column if not exists religion text;

create index if not exists idx_profiles_religion
  on public.profiles (religion);
