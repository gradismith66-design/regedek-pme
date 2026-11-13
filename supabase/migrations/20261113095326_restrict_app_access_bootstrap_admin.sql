begin;

drop policy if exists "Public can read registry" on public.pmes;
drop policy if exists "Public can read purchases" on public.achats;
drop policy if exists "Public can read settings" on public.settings;
revoke all on public.pmes, public.achats, public.settings from anon, public;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.admin_bootstrap_config (
  id boolean primary key default true check (id),
  first_admin_email text not null
);
alter table private.admin_bootstrap_config enable row level security;
insert into private.admin_bootstrap_config (id, first_admin_email)
values (true, 'gradismith66@gmail.com');

create or replace function public.admin_bootstrap_available()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.staff_profiles)
$$;
revoke all on function public.admin_bootstrap_available() from public, anon, authenticated;
grant execute on function public.admin_bootstrap_available() to anon, authenticated;

create or replace function public.bootstrap_first_admin()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  allowed_email text;
begin
  if current_user_id is null then
    raise exception 'Une session authentifiée est requise.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(74123581);

  select lower(u.email) into current_email
  from auth.users u
  where u.id = current_user_id
    and u.email_confirmed_at is not null;
  if current_email is null then
    raise exception 'Confirme cette adresse e-mail avant de créer le compte administrateur.';
  end if;

  select lower(c.first_admin_email) into allowed_email
  from private.admin_bootstrap_config c
  where c.id = true;
  if current_email <> allowed_email then
    raise exception 'Cette adresse e-mail n’est pas autorisée pour le premier compte administrateur.';
  end if;

  if exists (select 1 from public.staff_profiles) then
    raise exception 'Le compte administrateur initial a déjà été créé.';
  end if;

  insert into public.staff_profiles (user_id, role)
  values (current_user_id, 'admin');
end;
$$;
revoke all on function public.bootstrap_first_admin() from public, anon, authenticated;
grant execute on function public.bootstrap_first_admin() to authenticated;

commit;
