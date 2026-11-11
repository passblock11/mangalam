-- ─────────────────────────────────────────────────────────────────────────────
-- Reports + Ban system
-- Run this in the Supabase SQL Editor on project behlr (behlrsqilhzhniglhgqh)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Ban columns on profiles ─────────────────────────────────────────────
alter table public.profiles add column if not exists is_banned boolean not null default false;
alter table public.profiles add column if not exists banned_at timestamptz;
alter table public.profiles add column if not exists ban_reason text;
create index if not exists idx_profiles_is_banned on public.profiles (is_banned) where is_banned = true;

comment on column public.profiles.is_banned is 'When true, the user cannot use the app. Backend requireAuth rejects their token and the app signs them out.';
comment on column public.profiles.ban_reason is 'Admin-visible reason for the ban. Shown to the user in the app ban screen.';

-- ─── 2. Extend reports table ─────────────────────────────────────────────────
alter table public.reports add column if not exists title text;
alter table public.reports add column if not exists description text;
alter table public.reports add column if not exists category text not null default 'other';
alter table public.reports add column if not exists screenshot_urls text[] not null default '{}';
alter table public.reports add column if not exists reviewed_at timestamptz;
alter table public.reports add column if not exists reviewed_by uuid;
alter table public.reports add column if not exists admin_notes text;
alter table public.reports add column if not exists resolution text;

-- category check constraint
alter table public.reports drop constraint if exists reports_category_check;
alter table public.reports add constraint reports_category_check
  check (category in ('scam_fraud','harassment','fake_profile','inappropriate','illegal','other'));

-- status was already constrained to open/reviewing/closed in 0001; add 'actioned'
alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check
  check (status in ('open','reviewing','closed','actioned'));

comment on column public.reports.title is 'Short complaint title entered by the reporter.';
comment on column public.reports.description is 'Detailed complaint description entered by the reporter.';
comment on column public.reports.category is 'scam_fraud | harassment | fake_profile | inappropriate | illegal | other';
comment on column public.reports.screenshot_urls is 'Public URLs of screenshot images uploaded by the reporter (report-screenshots bucket).';
comment on column public.reports.resolution is 'Admin action taken, e.g. banned, warned, dismissed.';

-- ─── 3. report-screenshots storage bucket (public read, auth write) ──────────
insert into storage.buckets (id, name, public)
values ('report-screenshots', 'report-screenshots', true)
on conflict (id) do nothing;

-- Allow any authenticated user to upload to their own folder
drop policy if exists "report_screenshots_upload" on storage.objects;
create policy "report_screenshots_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'report-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

-- Public read (so admin can view without signed URLs)
drop policy if exists "report_screenshots_read" on storage.objects;
create policy "report_screenshots_read" on storage.objects
  for select using (bucket_id = 'report-screenshots');

-- Owners can delete their own screenshots
drop policy if exists "report_screenshots_delete" on storage.objects;
create policy "report_screenshots_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'report-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── 4. Reload PostgREST schema cache ───────────────────────────────────────
notify pgrst, 'reload schema';
