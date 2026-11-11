-- ============================================================================
-- NOTIFICATIONS + REALTIME — Run this in the Supabase SQL editor for project behlr
-- (behlrsqilhzhniglhgqh): https://supabase.com/dashboard/project/behlrsqilhzhniglhgqh/sql/new
--
-- Adds:
--   1. notifications table (in-app notification feed, one row per event)
--   2. notification_tokens table (FCM device tokens for push delivery)
--   3. RLS so users can only read/write their own rows
--   4. Realtime publication on messages + notifications (for live chat + badge)
-- Idempotent (IF NOT EXISTS / ON CONFLICT).
-- ============================================================================

-- ─── 1. notifications ───────────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('like','match','message','shortlist','view','system','verification','report')),
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_profile_created
  on public.notifications (profile_id, created_at desc);
create index if not exists idx_notifications_unread
  on public.notifications (profile_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Service role bypasses RLS, so backend inserts/updates work without a policy.
comment on table public.notifications is 'In-app notification feed. Backend (service role) inserts rows on like/match/message/shortlist events. Users read + mark-read their own.';
comment on column public.notifications.type is 'like | match | message | shortlist | view | system | verification | report';
comment on column public.notifications.data is 'JSON payload, e.g. {from_profile_id, conversation_id, interaction_id}';

-- ─── 2. notification_tokens (FCM push tokens) ────────────────────────────────
create table if not exists public.notification_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  fcm_token text not null,
  platform text check (platform in ('android','ios','web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, fcm_token)
);

create index if not exists idx_notif_tokens_profile on public.notification_tokens (profile_id);

alter table public.notification_tokens enable row level security;

drop policy if exists "notif_tokens_select_own" on public.notification_tokens;
create policy "notif_tokens_select_own"
  on public.notification_tokens for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "notif_tokens_insert_own" on public.notification_tokens;
create policy "notif_tokens_insert_own"
  on public.notification_tokens for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "notif_tokens_delete_own" on public.notification_tokens;
create policy "notif_tokens_delete_own"
  on public.notification_tokens for delete to authenticated
  using (profile_id = auth.uid());

comment on table public.notification_tokens is 'FCM device tokens per user. Backend reads these to send push notifications. Users register their own token after Firebase init.';

-- ─── 3. Realtime publication ─────────────────────────────────────────────────
-- Enable Realtime on messages (for live chat) and notifications (for badge/feed).
-- Supabase exposes tables via the "supabase_realtime" publication.
do $$
declare
  t text;
begin
  foreach t in array array['messages','notifications'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ─── 4. Reload PostgREST schema cache ─────────────────────────────────────────
notify pgrst, 'reload schema';
