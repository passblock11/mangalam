-- 0008_verification_and_contacts.sql
-- Run on behlr project (behlrsqilhzhniglhgqh).

-- 1. WhatsApp number on profiles
alter table public.profiles
  add column if not exists whatsapp_number text;

-- 2. Verification fields
alter table public.profiles
  add column if not exists verification_status text not null default 'none';
alter table public.profiles
  add column if not exists selfie_url text;
alter table public.profiles
  add column if not exists govt_id_url text;
alter table public.profiles
  add column if not exists verification_submitted_at timestamptz;
alter table public.profiles
  add column if not exists verification_reviewed_at timestamptz;
alter table public.profiles
  add column if not exists verification_note text;

-- Index for admin queue
create index if not exists idx_profiles_verification_status
  on public.profiles (verification_status);

-- 3. Private storage bucket for verification documents (selfie + govt ID)
insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

-- 4. Storage policies for verification-docs
--    Owner can upload/update/delete their own folder; admins can read all.
drop policy if exists "verif_docs_insert_own" on storage.objects;
create policy "verif_docs_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verification-docs'
    and (string_to_array(name, '/'))[1] = auth.uid()::text
  );

drop policy if exists "verif_docs_update_own" on storage.objects;
create policy "verif_docs_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'verification-docs'
    and (string_to_array(name, '/'))[1] = auth.uid()::text
  );

drop policy if exists "verif_docs_delete_own" on storage.objects;
create policy "verif_docs_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'verification-docs'
    and (string_to_array(name, '/'))[1] = auth.uid()::text
  );

-- Admins can read all verification docs (service role bypasses RLS anyway,
-- but this lets any admin-flagged authenticated user read).
drop policy if exists "verif_docs_read_admin" on storage.objects;
create policy "verif_docs_read_admin"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- Owners can read their own verification docs too.
drop policy if exists "verif_docs_read_own" on storage.objects;
create policy "verif_docs_read_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and (string_to_array(name, '/'))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
