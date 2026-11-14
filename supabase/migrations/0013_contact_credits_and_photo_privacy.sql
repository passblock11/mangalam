-- Contact credit prices (admin) and separate phone / WhatsApp reveals.
-- Photo privacy itself is stored in profiles.preferences.photos_visible
-- and does not need a new column.
-- Run on the behlr project (behlrsqilhzhniglhgqh).

alter table public.app_settings
  add column if not exists phone_credit_cost int not null default 1,
  add column if not exists whatsapp_credit_cost int not null default 1;

alter table public.phone_reveals
  add column if not exists channel text not null default 'phone';

create index if not exists idx_phone_reveals_pair_channel
  on public.phone_reveals (revealer_id, target_id, channel);
