begin;

alter table public.pmes
  add column if not exists archived_at timestamptz;

drop policy if exists "Admins can delete registry records" on public.pmes;
revoke delete on public.pmes from authenticated;

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
    where s.user_id = auth.uid()
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
