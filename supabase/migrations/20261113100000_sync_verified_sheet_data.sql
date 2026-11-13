begin;

do $$
declare
  affected_rows integer;
  matching_rows integer;
  new_sepronac_id bigint;
  gmk_id bigint;
  recoland_id bigint;
begin
  select count(*), min(id)
  into matching_rows, new_sepronac_id
  from public.pmes
  where nom = 'NEW SEPRONAC';
  if matching_rows <> 1 then
    raise exception 'Expected one PME named NEW SEPRONAC, found %. Check the PME name in public.pmes before retrying.', matching_rows;
  end if;

  select count(*), min(id)
  into matching_rows, gmk_id
  from public.pmes
  where nom = 'SOCIETE GMK ASSAINISSEMENT';
  if matching_rows <> 1 then
    raise exception 'Expected one PME named SOCIETE GMK ASSAINISSEMENT, found %. Check the PME name in public.pmes before retrying.', matching_rows;
  end if;

  select count(*), min(id)
  into matching_rows, recoland_id
  from public.pmes
  where nom = 'RECOLAND SAS';
  if matching_rows <> 1 then
    raise exception 'Expected one PME named RECOLAND SAS, found %. Check the PME name in public.pmes before retrying.', matching_rows;
  end if;

  update public.pmes
  set date_agr = date '2025-05-26',
      exp_agr = date '2026-05-26'
  where id = new_sepronac_id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Expected to update NEW SEPRONAC, updated % rows', affected_rows;
  end if;

  update public.pmes
  set num_aut = 'REGEDEK/DSG/EBM/071/2026',
      date_aut = date '2026-03-30',
      exp_aut = date '2027-03-30'
  where id = gmk_id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Expected to update SOCIETE GMK ASSAINISSEMENT, updated % rows', affected_rows;
  end if;

  update public.pmes
  set date_agr = date '2026-07-15'
  where id = recoland_id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Expected to update RECOLAND SAS, updated % rows', affected_rows;
  end if;

  insert into public.achats (pme_id, date, qte, detail)
  select new_sepronac_id, date '2026-10-29', 600, '[200,200,200]'::jsonb
  where not exists (
    select 1
    from public.achats
    where pme_id = new_sepronac_id
      and date = date '2026-10-29'
      and qte = 600
      and detail = '[200,200,200]'::jsonb
  );
end;
$$;

commit;
