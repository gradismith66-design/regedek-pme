begin;

do $$
declare
  matching_rows integer;
begin
  -- The PDF spells this registrant PERFORMENCE SERVICE; the authorization
  -- number and date match the existing PERFORMANCE row.
  select count(*) into matching_rows
  from public.pmes
  where nom in ('PERFORMANCE', 'PERFORMENCE SERVICE');
  if matching_rows <> 1 then
    raise exception 'Expected exactly one PERFORMANCE/PERFORMENCE SERVICE row, found %; resolve duplicates before applying this migration.', matching_rows;
  end if;
  update public.pmes
  set nom = 'PERFORMENCE SERVICE'
  where nom = 'PERFORMANCE';

  select count(*) into matching_rows
  from public.pmes
  where nom in ('SOCIETE GRACE OF THE IVINNER', 'SOCIETE GRACE OF THE WINNER');
  if matching_rows <> 1 then
    raise exception 'Expected exactly one SOCIETE GRACE row, found %; resolve duplicates before applying this migration.', matching_rows;
  end if;
  update public.pmes
  set nom = 'SOCIETE GRACE OF THE WINNER'
  where nom = 'SOCIETE GRACE OF THE IVINNER';

  select count(*) into matching_rows
  from public.pmes
  where nom in ('NZITA MBUTA ELYSE', 'DASCO (NZITA MBUTA ELYSE)');
  if matching_rows <> 1 then
    raise exception 'Expected exactly one DASCO/NZITA MBUTA row, found %; resolve duplicates before applying this migration.', matching_rows;
  end if;
  update public.pmes
  set nom = 'DASCO (NZITA MBUTA ELYSE)'
  where nom = 'NZITA MBUTA ELYSE';
end;
$$;

commit;
