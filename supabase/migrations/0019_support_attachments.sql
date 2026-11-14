-- Optional photos on a support message.
-- Run this if 0018 was already applied. A fresh 0018 already includes the column.
-- Photos themselves go in the existing report-screenshots bucket, under
-- {member id}/support/, so no new storage bucket is required.

alter table public.support_messages
  add column if not exists attachment_urls text[] not null default '{}';
