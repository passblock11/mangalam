-- 0015_app_branding.sql
-- Splash and login appearance, plus a public bucket for logo and background images.
-- Run on the behlr project (behlrsqilhzhniglhgqh) in the SQL editor.
-- Does not change plans, admins, payments, or member data.
-- The current Mangalam design is stored in branding.builtin and stays selectable.

alter table public.app_settings
  add column if not exists branding jsonb not null default '{}'::jsonb;

update public.app_settings
set branding = jsonb_build_object(
  'active', 'default',
  'builtin', jsonb_build_object(
    'id', 'mangalam_current',
    'label', 'Current Mangalam design',
    'app_name', 'Mangalam',
    'tagline', 'Find your perfect match',
    'splash', jsonb_build_object(
      'animation', 'scale_fade',
      'duration_ms', 3000,
      'background_start', '#B71C1C',
      'background_end', '#7E0F0F',
      'accent', '#C9A227',
      'title_color', '#FFFFFF',
      'show_loader', true
    ),
    'login', jsonb_build_object(
      'headline', E'Find your\nperfect match.',
      'subheadline', E'Trusted by thousands of families to\nfind meaningful, verified alliances.',
      'welcome_title', 'Welcome',
      'welcome_subtitle', 'Sign in to continue your journey.',
      'sheet_color', '#FFF8F3',
      'show_mandala', true
    )
  ),
  'custom', jsonb_build_object(
    'app_name', '',
    'tagline', '',
    'logo_url', null,
    'splash', jsonb_build_object(
      'animation', 'scale_fade',
      'duration_ms', 3000,
      'background_start', '#B71C1C',
      'background_end', '#7E0F0F',
      'accent', '#C9A227',
      'title_color', '#FFFFFF',
      'background_image_url', null,
      'show_loader', true
    ),
    'login', jsonb_build_object(
      'headline', '',
      'subheadline', '',
      'welcome_title', '',
      'welcome_subtitle', '',
      'background_images', '[]'::jsonb,
      'sheet_color', '#FFF8F3',
      'show_mandala', true
    )
  )
)
where id = 1
  and (branding is null or branding = '{}'::jsonb);

insert into storage.buckets (id, name, public)
values ('app-branding', 'app-branding', true)
on conflict (id) do nothing;

drop policy if exists "app_branding_public_read" on storage.objects;
create policy "app_branding_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'app-branding');
