begin;

do $$
begin
  if not exists (
    select 1
    from auth.users
    where lower(email) = 'ootshudy@tuta.io'
  ) then
    raise exception 'Super-admin account not found in auth.users: ootshudy@tuta.io';
  end if;
end
$$;

insert into public.staff_profiles (user_id, role)
select id, 'admin'
from auth.users
where lower(email) = 'ootshudy@tuta.io'
on conflict (user_id) do update
set role = excluded.role;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_profiles s
    join auth.users u on u.id = s.user_id
    where s.user_id = (select auth.uid())
      and s.role = 'admin'
      and lower(u.email) in (
        'gradismith66@gmail.com',
        'ootshudy@tuta.io'
      )
  )
$$;

commit;
