grant usage on schema public to anon;
grant select on public.pmes, public.achats, public.settings to anon;

create policy "Public can read registry"
  on public.pmes for select to anon, authenticated
  using (true);

create policy "Public can read purchases"
  on public.achats for select to anon, authenticated
  using (true);

create policy "Public can read settings"
  on public.settings for select to anon, authenticated
  using (true);
