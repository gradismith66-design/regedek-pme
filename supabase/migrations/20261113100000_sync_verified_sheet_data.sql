begin;

do $$
declare
  affected_rows integer;
begin
  update public.pmes
  set date_agr = date '2025-05-26',
      exp_agr = date '2026-05-26'
  where id = 13 and nom = 'NEW SEPRONAC';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Expected to update NEW SEPRONAC (id 13), updated % rows', affected_rows;
  end if;

  update public.pmes
  set num_aut = 'REGEDEK/DSG/EBM/071/2026',
      date_aut = date '2026-03-30',
      exp_aut = date '2027-03-30'
  where id = 90 and nom = 'SOCIETE GMK ASSAINISSEMENT';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Expected to update SOCIETE GMK ASSAINISSEMENT (id 90), updated % rows', affected_rows;
  end if;

  update public.pmes
  set date_agr = date '2026-07-15'
  where id = 95 and nom = 'RECOLAND SAS';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Expected to update RECOLAND SAS (id 95), updated % rows', affected_rows;
  end if;

  insert into public.achats (pme_id, date, qte, detail)
  select 13, date '2026-10-29', 600, '[200,200,200]'::jsonb
  where not exists (
    select 1
    from public.achats
    where pme_id = 13
      and date = date '2026-10-29'
      and qte = 600
      and detail = '[200,200,200]'::jsonb
  );
end;
$$;

commit;
