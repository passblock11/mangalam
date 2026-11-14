-- Wipe member accounts and member activity only.
-- Run in the behlr SQL editor (project behlrsqilhzhniglhgqh).
--
-- Left untouched:
--   admins, plans, app_settings, payment_methods, coupons, legal_pages,
--   storage buckets, storage policies.
--
-- Removed:
--   app sign-ins, profiles, likes, blocks, views, chats, contact reveals,
--   reports, notifications, wallets, memberships, payment history,
--   phone OTP rows, support tickets, message-credit charges.
-- Member files stay in Storage. Supabase blocks deleting those rows in SQL.
-- After this succeeds, empty these buckets in Dashboard → Storage
-- (the buckets themselves stay):
--   profile-photos, chat-attachments, verification-docs, report-screenshots

begin;

do $$
declare
  plans_before int;
  admins_before int;
  settings_before int;
  methods_before int;
  coupons_before int;
  legal_before int;
  user_tables text;
begin
  select count(*) into plans_before from public.plans;
  select count(*) into admins_before from public.admins;
  select count(*) into settings_before from public.app_settings;
  select count(*) into methods_before from public.payment_methods;
  select count(*) into coupons_before from public.coupons;
  select count(*) into legal_before from public.legal_pages;

  select string_agg(format('%I.%I', n.nspname, c.relname), ', ')
    into user_tables
  from (
    values
      ('message_credit_charges'),
      ('support_messages'),
      ('support_ticket_events'),
      ('support_tickets'),
      ('messages'),
      ('phone_reveals'),
      ('conversation_members'),
      ('conversations'),
      ('notifications'),
      ('notification_tokens'),
      ('member_subscriptions'),
      ('razorpay_payment_credits'),
      ('interactions'),
      ('blocks'),
      ('profile_views'),
      ('reports'),
      ('profile_photos'),
      ('wallets'),
      ('phone_otp_challenges'),
      ('phone_otp_send_log')
  ) as wanted(relname)
  join pg_class c on c.relname = wanted.relname
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public';

  if user_tables is not null then
    execute 'truncate table ' || user_tables || ' restart identity';
  end if;

  -- App accounts. Admin panel logins live in public.admins, not here.
  -- profiles and any remaining member rows cascade from this delete.
  delete from auth.users;

  if (select count(*) from public.plans) <> plans_before
     or (select count(*) from public.admins) <> admins_before
     or (select count(*) from public.app_settings) <> settings_before
     or (select count(*) from public.payment_methods) <> methods_before
     or (select count(*) from public.coupons) <> coupons_before
     or (select count(*) from public.legal_pages) <> legal_before then
    raise exception 'Admin configuration changed. Aborting.';
  end if;
end $$;

commit;
