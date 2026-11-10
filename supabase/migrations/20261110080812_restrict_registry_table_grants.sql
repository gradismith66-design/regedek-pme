revoke all privileges on all tables in schema public from public, anon, authenticated;
revoke all privileges on all sequences in schema public from public, anon, authenticated;
revoke all privileges on schema public from anon;

alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.pmes, public.achats to authenticated;
grant select, update on public.settings to authenticated;
grant select on public.staff_profiles to authenticated;
grant usage, select on all sequences in schema public to authenticated;

