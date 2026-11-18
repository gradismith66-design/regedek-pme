begin;

alter table public.achats
  add column if not exists designation text not null default '',
  add column if not exists unite text not null default 'sacs',
  add column if not exists prix_unitaire numeric(14, 2),
  add column if not exists devise text,
  add column if not exists montant_total numeric(24, 2)
    generated always as (
      case
        when prix_unitaire is null then null
        else round(qte::numeric * prix_unitaire, 2)
      end
    ) stored;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.achats'::regclass
      and conname = 'achats_unit_price_nonnegative_check'
  ) then
    alter table public.achats
      add constraint achats_unit_price_nonnegative_check
      check (prix_unitaire is null or prix_unitaire >= 0) not valid;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.achats'::regclass
      and conname = 'achats_price_currency_check'
  ) then
    alter table public.achats
      add constraint achats_price_currency_check
      check (
        (prix_unitaire is null and devise is null)
        or (prix_unitaire is not null and devise in ('CDF', 'USD'))
      ) not valid;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.achats'::regclass
      and conname = 'achats_price_designation_check'
  ) then
    alter table public.achats
      add constraint achats_price_designation_check
      check (
        (prix_unitaire is null and designation = '')
        or (prix_unitaire is not null and length(trim(designation)) > 0)
      ) not valid;
  end if;
end;
$$;

alter table public.achats validate constraint achats_unit_price_nonnegative_check;
alter table public.achats validate constraint achats_price_currency_check;
alter table public.achats validate constraint achats_price_designation_check;

create or replace function public.report_activity(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  id bigint,
  actor_id uuid,
  actor_email text,
  actor_name text,
  actor_role text,
  operation text,
  entity_type text,
  entity_id text,
  pme_id bigint,
  purchase_id bigint,
  created_at timestamptz,
  details jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.staff_has_permission('reports.read') then
    raise exception 'La consultation des rapports n’est pas autorisée.';
  end if;

  return query
    select a.id, a.actor_id, a.actor_email, a.actor_name, a.actor_role,
           a.operation, a.entity_type, a.entity_id, a.pme_id, a.purchase_id, a.created_at,
           case when private.staff_has_permission('activity.read') then a.details else '{}'::jsonb end
    from public.staff_activity_log a
    where (p_from is null or a.created_at >= p_from)
      and (p_to is null or a.created_at < p_to)
    order by a.created_at desc, a.id desc
    limit 10000;
end;
$$;
revoke all on function public.report_activity(timestamptz, timestamptz) from public, anon;
grant execute on function public.report_activity(timestamptz, timestamptz) to authenticated;

commit;
