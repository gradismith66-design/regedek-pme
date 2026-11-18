begin;

alter table public.pmes
  add column if not exists archived_at timestamptz;

alter table public.achats
  drop constraint if exists achats_pme_id_fkey;
alter table public.achats
  add constraint achats_pme_id_fkey
  foreign key (pme_id) references public.pmes(id) on delete restrict;

alter table public.pme_documents
  drop constraint if exists pme_documents_pme_id_fkey;
alter table public.pme_documents
  add constraint pme_documents_pme_id_fkey
  foreign key (pme_id) references public.pmes(id) on delete restrict;

alter table public.pme_inspection_reports
  drop constraint if exists pme_inspection_reports_pme_id_fkey;
alter table public.pme_inspection_reports
  add constraint pme_inspection_reports_pme_id_fkey
  foreign key (pme_id) references public.pmes(id) on delete restrict;

alter table public.pme_dossier_history
  drop constraint if exists pme_dossier_history_pme_id_fkey;
alter table public.pme_dossier_history
  add constraint pme_dossier_history_pme_id_fkey
  foreign key (pme_id) references public.pmes(id) on delete restrict;

alter table public.pme_authorization_history
  drop constraint if exists pme_authorization_history_pme_id_fkey;
alter table public.pme_authorization_history
  add constraint pme_authorization_history_pme_id_fkey
  foreign key (pme_id) references public.pmes(id) on delete restrict;

drop policy if exists "Admins can delete registry records" on public.pmes;
revoke delete on public.pmes from public, anon, authenticated;

drop policy if exists "Staff can read registry" on public.pmes;
create policy "Staff can read registry"
  on public.pmes for select to authenticated
  using (
    archived_at is null
    and exists (
      select 1 from public.staff_profiles s
      where s.user_id = (select auth.uid())
    )
    or archived_at is not null
    and exists (
      select 1 from public.staff_profiles s
      where s.user_id = (select auth.uid()) and s.role = 'admin'
    )
  );

drop policy if exists "Agents can create registry records" on public.pmes;
create policy "Agents can create registry records"
  on public.pmes for insert to authenticated
  with check (
    archived_at is null
    and exists (
      select 1 from public.staff_profiles s
      where s.user_id = (select auth.uid()) and s.role in ('admin', 'agent')
    )
  );

drop policy if exists "Agents can update registry records" on public.pmes;
create policy "Agents can update registry records"
  on public.pmes for update to authenticated
  using (
    archived_at is null
    and exists (
      select 1 from public.staff_profiles s
      where s.user_id = (select auth.uid()) and s.role in ('admin', 'agent')
    )
  )
  with check (
    archived_at is null
    and exists (
      select 1 from public.staff_profiles s
      where s.user_id = (select auth.uid()) and s.role in ('admin', 'agent')
    )
  );

create or replace function public.set_pme_archived(p_pme_id bigint, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.staff_profiles s
    where s.user_id = (select auth.uid())
      and s.role = 'admin'
  ) then
    raise exception 'Seul un administrateur peut archiver ou restaurer une PME.';
  end if;

  update public.pmes
  set archived_at = case when p_archived then now() else null end
  where id = p_pme_id;

  if not found then
    raise exception 'PME introuvable.';
  end if;
end;
$$;

revoke all on function public.set_pme_archived(bigint, boolean) from public, anon;
grant execute on function public.set_pme_archived(bigint, boolean) to authenticated;

commit;
