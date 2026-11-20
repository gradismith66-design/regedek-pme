begin;

do $$
declare
  missing_emails text[];
begin
  select array_agg(requested.email order by requested.email)
  into missing_emails
  from (values
    ('dikambaisaac52@gmail.com'),
    ('moyelac@gmail.com'),
    ('papyfataki500@gmail.com')
  ) as requested(email)
  where not exists (
    select 1
    from auth.users u
    where lower(u.email) = requested.email
  );

  if coalesce(cardinality(missing_emails), 0) > 0 then
    raise exception 'Agent accounts not found in auth.users: %',
      array_to_string(missing_emails, ', ');
  end if;
end
$$;

insert into public.staff_profiles (user_id, role)
select u.id, 'agent'
from auth.users u
where lower(u.email) in (
  'dikambaisaac52@gmail.com',
  'moyelac@gmail.com',
  'papyfataki500@gmail.com'
)
on conflict (user_id) do update
set role = excluded.role;

commit;
