-- ─────────────────────────────────────────────────────────────────────────────
-- Setup real super admin for boratetejas62@gmail.com
-- Run this in the Supabase SQL Editor on project behlr (behlrsqilhzhniglhgqh)
--
-- Password hash is PBKDF2-SHA256 (120k iterations), generated with the same
-- algorithm as backend/src/admin-auth.ts so /v1/admin/login will accept it.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Remove the accidental bootstrap test admin (created by the probe endpoint)
delete from public.admins
 where email = 'test@test.com';

-- 2) Upsert the real super admin. Re-running this is safe — password gets reset
--    to the hash below each time, and the account is forced active + super.
insert into public.admins (email, password_hash, full_name, permissions, is_active, is_super_admin)
values (
  'boratetejas62@gmail.com',
  'pbkdf2$120000$f1b9cf85254e26e133a8c7646c3e96cc$1436be7c79a8fb781d855c77f72519b2e18d7243609e4fc21fc103a33e59468e',
  'Tejas Borate',
  '{}'::jsonb,
  true,
  true
)
on conflict (email) do update
   set password_hash   = excluded.password_hash,
       full_name       = excluded.full_name,
       is_active       = true,
       is_super_admin  = true,
       updated_at      = now();

-- 3) Sanity check — should show exactly one row now
select id, email, full_name, is_active, is_super_admin, created_at
  from public.admins
 order by created_at;
