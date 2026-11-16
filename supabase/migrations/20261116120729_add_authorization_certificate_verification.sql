begin;

alter table public.pmes
  add column if not exists authorization_verification_token uuid not null default gen_random_uuid();
create unique index if not exists pmes_authorization_verification_token_uidx
  on public.pmes(authorization_verification_token);

create or replace function public.verify_pme_authorization(verification_token uuid)
returns table (
  company_name text,
  authorization_reference text,
  issue_date date,
  expiry_date date,
  activity text,
  authorization_status text,
  is_valid boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.nom, p.authorization_reference, p.authorization_issue_date,
    p.authorization_expiry_date, p.type, p.authorization_status,
    p.authorization_status = 'AUTORISE'
      and p.authorization_expiry_date >= (now() at time zone 'Africa/Kinshasa')::date
  from public.pmes p
  where p.authorization_verification_token = verification_token
$$;
revoke all on function public.verify_pme_authorization(uuid) from public;
grant execute on function public.verify_pme_authorization(uuid) to anon, authenticated;

commit;
