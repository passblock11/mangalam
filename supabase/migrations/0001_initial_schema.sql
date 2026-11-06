-- Mangalam initial schema (Supabase Postgres)
-- Run in Supabase SQL editor after creating project.

-- Extensions
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique,
  display_name text,
  date_of_birth date,
  gender text check (gender in ('male', 'female', 'other')),
  community text,
  mother_tongue text,
  diet text,
  height_cm int,
  profile_for text,
  marital_status text,
  city text,
  state text,
  country text default 'India',
  bio text,
  is_verified boolean not null default false,
  is_admin boolean not null default false,
  phone_visible boolean not null default false,
  preferences jsonb not null default '{}'::jsonb,
  app_language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Wallet / subscription (server can adjust credits)
create table if not exists public.wallets (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  contact_credits int not null default 0,
  premium_until timestamptz,
  updated_at timestamptz not null default now()
);

-- Like / pass / shortlist
create type public.interaction_status as enum ('pending', 'mutual', 'passed', 'shortlisted');

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  from_profile_id uuid not null references public.profiles (id) on delete cascade,
  to_profile_id uuid not null references public.profiles (id) on delete cascade,
  status public.interaction_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (from_profile_id, to_profile_id),
  check (from_profile_id <> to_profile_id)
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- Who viewed whom (for "Views" tab)
create table if not exists public.profile_views (
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (viewer_id, viewed_id)
);

-- Messaging
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (conversation_id, profile_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- Phone reveal audit
create table if not exists public.phone_reveals (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  revealer_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Moderation
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_profile_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_profiles_city on public.profiles (city);
create index if not exists idx_profiles_gender on public.profiles (gender);
create index if not exists idx_interactions_to on public.interactions (to_profile_id);
create index if not exists idx_interactions_from on public.interactions (from_profile_id);
create index if not exists idx_messages_conversation on public.messages (conversation_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profile_photos enable row level security;
alter table public.wallets enable row level security;
alter table public.interactions enable row level security;
alter table public.blocks enable row level security;
alter table public.profile_views enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.phone_reveals enable row level security;
alter table public.reports enable row level security;

-- Profiles: read public-facing fields for authenticated users (API can bypass with service role)
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Photos
create policy "profile_photos_select_own"
  on public.profile_photos for select
  to authenticated
  using (profile_id = (select auth.uid()));

create policy "profile_photos_write_own"
  on public.profile_photos for insert
  to authenticated
  with check (profile_id = (select auth.uid()));

create policy "profile_photos_update_own"
  on public.profile_photos for update
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "profile_photos_delete_own"
  on public.profile_photos for delete
  to authenticated
  using (profile_id = (select auth.uid()));

-- Wallets: own row only
create policy "wallets_select_own"
  on public.wallets for select
  to authenticated
  using (profile_id = (select auth.uid()));

-- Server adjusts wallets via service role; no client update policies by default

-- Interactions: participants can see their rows
create policy "interactions_select_involved"
  on public.interactions for select
  to authenticated
  using (
    from_profile_id = (select auth.uid())
    or to_profile_id = (select auth.uid())
  );

create policy "interactions_insert_from_self"
  on public.interactions for insert
  to authenticated
  with check (from_profile_id = (select auth.uid()));

create policy "interactions_update_from_self"
  on public.interactions for update
  to authenticated
  using (from_profile_id = (select auth.uid()))
  with check (from_profile_id = (select auth.uid()));

-- Blocks
create policy "blocks_select_own"
  on public.blocks for select
  to authenticated
  using (blocker_id = (select auth.uid()));

create policy "blocks_insert_own"
  on public.blocks for insert
  to authenticated
  with check (blocker_id = (select auth.uid()));

-- Profile views (optional client logging)
create policy "views_insert_own"
  on public.profile_views for insert
  to authenticated
  with check (viewer_id = (select auth.uid()));

create policy "views_select_as_viewed"
  on public.profile_views for select
  to authenticated
  using (viewed_id = (select auth.uid()) or viewer_id = (select auth.uid()));

-- Conversations / members / messages: member-based
create policy "conv_members_select"
  on public.conversation_members for select
  to authenticated
  using (
    profile_id = (select auth.uid())
  );

create policy "messages_select_member"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversation_members m
      where m.conversation_id = messages.conversation_id
        and m.profile_id = (select auth.uid())
    )
  );

create policy "messages_insert_member"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.conversation_members m
      where m.conversation_id = messages.conversation_id
        and m.profile_id = (select auth.uid())
    )
  );

-- Conversations: visible if member
create policy "conversations_select_member"
  on public.conversations for select
  to authenticated
  using (
    exists (
      select 1 from public.conversation_members m
      where m.conversation_id = conversations.id
        and m.profile_id = (select auth.uid())
    )
  );

-- Phone reveals: participants only
create policy "phone_reveals_select"
  on public.phone_reveals for select
  to authenticated
  using (revealer_id = (select auth.uid()) or target_id = (select auth.uid()));

-- Reports
create policy "reports_insert"
  on public.reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()));

create policy "reports_select_own"
  on public.reports for select
  to authenticated
  using (reporter_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Triggers: create profile + wallet on signup
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone)
  on conflict (id) do nothing;

  insert into public.wallets (profile_id, contact_credits)
  values (new.id, 0)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Storage (profile photos bucket) — create bucket in Dashboard if not exists
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

-- Allow authenticated uploads to own folder: profile_id/filename
create policy "objects_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "objects_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'profile-photos');

create policy "objects_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "objects_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
