-- Admin console live updates. Run once in the behlr SQL editor.
-- Puts the tables the admin watches onto the Realtime publication, and
-- sends the previous row on update so last-active heartbeats can be ignored.

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles',
    'reports',
    'wallets',
    'razorpay_payment_credits',
    'member_subscriptions',
    'app_settings',
    'plans',
    'coupons',
    'payment_methods',
    'legal_pages',
    'admins'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;
