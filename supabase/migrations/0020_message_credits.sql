-- Charge contact credits when a member sends a chat message.
-- Prices live on app_settings so the admin panel can change them
-- without an app release. The ledger keeps the free-message count
-- even after a message is deleted, and a delete does not refund.
-- Run on the behlr project (behlrsqilhzhniglhgqh).

alter table public.app_settings
  add column if not exists message_credit_cost int not null default 1,
  add column if not exists message_free_per_chat int not null default 0,
  add column if not exists message_charge_replies boolean not null default true;

create table if not exists public.message_credit_charges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  message_id uuid,
  credits_charged int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_message_credit_charges_pair
  on public.message_credit_charges (conversation_id, profile_id, created_at);

alter table public.message_credit_charges enable row level security;
