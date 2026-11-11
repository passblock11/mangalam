-- 0007_profile_photos.sql
-- Adds photo support: profiles.photo_urls + a public Supabase Storage bucket.
-- Run on the behlr project (behlrsqilhzhniglhgqh).

-- 1. Column on profiles
alter table public.profiles
  add column if not exists photo_urls text[] not null default '{}';

-- 2. Storage bucket (public read, authenticated write)
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

-- 3. Storage policies
drop policy if exists "profile_photos_read" on storage.objects;
create policy "profile_photos_read"
  on storage.objects for select
  using (bucket_id = 'profile-photos');

drop policy if exists "profile_photos_insert_own" on storage.objects;
create policy "profile_photos_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (string_to_array(name, '/'))[1] = auth.uid()::text
  );

drop policy if exists "profile_photos_update_own" on storage.objects;
create policy "profile_photos_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (string_to_array(name, '/'))[1] = auth.uid()::text
  );

drop policy if exists "profile_photos_delete_own" on storage.objects;
create policy "profile_photos_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (string_to_array(name, '/'))[1] = auth.uid()::text
  );

-- 4. Reload PostgREST schema cache so the new column is visible
notify pgrst, 'reload schema';
