-- Set display_name from OAuth metadata when profile is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), '')
  );

  insert into public.profiles (id, phone, display_name)
  values (new.id, new.phone, nullif(v_name, ''))
  on conflict (id) do nothing;

  insert into public.wallets (profile_id, contact_credits)
  values (new.id, 0)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;
