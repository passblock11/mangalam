-- Support tickets. Run once in the behlr SQL editor.
-- Members send a ticket in the app. The admin replies and moves the status.
-- Each change is stored so the member can see the full history, and the
-- admin list updates live.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated always as identity,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  category text not null check (category in ('account', 'verification', 'payment', 'technical', 'other')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_on_you', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_profile
  on public.support_tickets (profile_id, updated_at desc);

create index if not exists idx_support_tickets_status
  on public.support_tickets (status, updated_at desc);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_role text not null check (author_role in ('member', 'admin')),
  body text not null,
  attachment_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_support_messages_ticket
  on public.support_messages (ticket_id, created_at);

create table if not exists public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_role text not null check (actor_role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

create index if not exists idx_support_ticket_events_ticket
  on public.support_ticket_events (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_ticket_events enable row level security;

-- Allow the new notification type used when a ticket changes.
do $$
declare
  c name;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'notifications'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%type%'
  loop
    execute format('alter table public.notifications drop constraint %I', c);
  end loop;
end $$;

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'like', 'match', 'message', 'shortlist', 'view',
    'system', 'verification', 'report', 'support'
  ));

do $$
declare
  t text;
begin
  foreach t in array array['support_tickets', 'support_messages']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;
