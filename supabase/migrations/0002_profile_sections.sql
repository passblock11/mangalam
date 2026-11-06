-- Partner expectations, astrology, occupation, activity (run after 0001)

alter table public.profiles
  add column if not exists last_active_at timestamptz;

alter table public.profiles
  add column if not exists mangal_dosh text;

alter table public.profiles
  add column if not exists birth_time time without time zone;

alter table public.profiles
  add column if not exists birth_place text;

alter table public.profiles
  add column if not exists occupation text;

alter table public.profiles
  add column if not exists education_level text;

alter table public.profiles
  add column if not exists monthly_salary text;

-- Structured partner preferences (age range, location text, filters, etc.)
alter table public.profiles
  add column if not exists partner_preferences jsonb not null default '{}'::jsonb;

comment on column public.profiles.partner_preferences is
  'Partner expectations: e.g. age_min, age_max, location, height, diet, marital_status, mother_tongue, mangal_dosh, occupation, monthly_salary, education_level';

update public.profiles set last_active_at = coalesce(last_active_at, updated_at);
