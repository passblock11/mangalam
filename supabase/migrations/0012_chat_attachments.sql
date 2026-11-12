-- 0012_chat_attachments.sql
-- Adds attachment support to messages (images / videos / files) and a
-- public storage bucket for chat media.
--
-- RUN MANUALLY on the behlr project via the Supabase SQL Editor
-- (the Supabase MCP is connected to a different project).

-- 1) Attachment columns on messages -----------------------------------------
alter table public.messages
  add column if not exists attachment_url text,
  add column if not exists attachment_type text
    check (attachment_type in ('image', 'video', 'file', 'audio')),
  add column if not exists attachment_name text,
  add column if not exists attachment_mime text,
  add column if not exists attachment_size integer;

-- Allow a message to carry only an attachment (body may be empty).
alter table public.messages alter column body set default '';
alter table public.messages
  add constraint messages_body_or_attachment
  check (coalesce(nullif(body, ''), nullif(attachment_url, '')) is not null);

-- 2) Public storage bucket for chat attachments -----------------------------
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

-- Authenticated users may upload into their own folder.
create policy "chat_attach_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Public read (so recipients can view attachments).
create policy "chat_attach_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'chat-attachments');

-- Owners can delete their own attachments.
create policy "chat_attach_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
