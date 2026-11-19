begin;

alter table public.settings
  add column if not exists taux_cdf_par_usd numeric(14, 2) not null default 2300;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.settings'::regclass
      and conname = 'settings_exchange_rate_positive_check'
  ) then
    alter table public.settings
      add constraint settings_exchange_rate_positive_check
      check (taux_cdf_par_usd > 0) not valid;
  end if;
end;
$$;
alter table public.settings validate constraint settings_exchange_rate_positive_check;

alter table public.achats
  add column if not exists taux_cdf_par_usd numeric(14, 2),
  add column if not exists montant_cdf numeric(24, 2)
    generated always as (
      case
        when prix_unitaire is null then null
        when devise = 'CDF' then round(qte::numeric * prix_unitaire, 2)
        when devise = 'USD' and taux_cdf_par_usd is not null
          then round(qte::numeric * prix_unitaire * taux_cdf_par_usd, 2)
        else null
      end
    ) stored,
  add column if not exists montant_usd numeric(24, 2)
    generated always as (
      case
        when prix_unitaire is null then null
        when devise = 'USD' then round(qte::numeric * prix_unitaire, 2)
        when devise = 'CDF' and taux_cdf_par_usd is not null
          then round(qte::numeric * prix_unitaire / taux_cdf_par_usd, 2)
        else null
      end
    ) stored;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.achats'::regclass
      and conname = 'achats_exchange_rate_positive_check'
  ) then
    alter table public.achats
      add constraint achats_exchange_rate_positive_check
      check (taux_cdf_par_usd is null or taux_cdf_par_usd > 0) not valid;
  end if;
end;
$$;
alter table public.achats validate constraint achats_exchange_rate_positive_check;

comment on column public.achats.taux_cdf_par_usd is
  'Conversion CDF/USD capturée à la création; les mises à jour ultérieures ne changent pas les montants historiques.';
comment on column public.achats.montant_cdf is
  'Montant en CDF calculé à partir du prix, de la devise et du taux enregistré sur l’achat.';
comment on column public.achats.montant_usd is
  'Équivalent USD arrondi à deux décimales à partir du taux enregistré sur l’achat.';

create or replace function private.capture_purchase_pricing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_bag_price constant numeric(14, 2) := 700;
  current_exchange_rate numeric(14, 2);
  new_is_bag boolean;
  old_is_bag boolean;
begin
  new_is_bag :=
    lower(regexp_replace(coalesce(new.designation, ''), '[^a-zA-Z0-9]+', ' ', 'g'))
      ~ '\msacs? +(a |pour )?poubelles?\M'
    and lower(regexp_replace(coalesce(new.unite, ''), '[^a-zA-Z0-9]+', ' ', 'g'))
      ~ '^sacs?( poubelles?)?$';

  if tg_op = 'INSERT' then
    select settings.taux_cdf_par_usd
      into current_exchange_rate
      from public.settings
      where settings.id = true;

    if current_exchange_rate is null then
      raise exception 'Le taux de conversion des achats n’est pas configuré.';
    end if;

    new.taux_cdf_par_usd := current_exchange_rate;
    if new_is_bag then
      new.designation := 'Sacs-poubelle';
      new.unite := 'sacs';
      new.prix_unitaire := current_bag_price;
      new.devise := 'CDF';
    end if;
    return new;
  end if;

  old_is_bag :=
    lower(regexp_replace(coalesce(old.designation, ''), '[^a-zA-Z0-9]+', ' ', 'g'))
      ~ '\msacs? +(a |pour )?poubelles?\M'
    and lower(regexp_replace(coalesce(old.unite, ''), '[^a-zA-Z0-9]+', ' ', 'g'))
      ~ '^sacs?( poubelles?)?$';
  new.taux_cdf_par_usd := old.taux_cdf_par_usd;

  if new_is_bag and not old_is_bag then
    select settings.taux_cdf_par_usd
      into current_exchange_rate
      from public.settings
      where settings.id = true;
    if current_exchange_rate is null then
      raise exception 'Le taux de conversion des achats n’est pas configuré.';
    end if;
    new.taux_cdf_par_usd := current_exchange_rate;
    new.designation := 'Sacs-poubelle';
    new.unite := 'sacs';
    new.prix_unitaire := current_bag_price;
    new.devise := 'CDF';
  elsif new_is_bag and old_is_bag then
    new.designation := old.designation;
    new.unite := old.unite;
    new.prix_unitaire := old.prix_unitaire;
    new.devise := old.devise;
  end if;
  return new;
end;
$$;
revoke all on function private.capture_purchase_pricing() from public, anon, authenticated;

drop trigger if exists capture_purchase_pricing on public.achats;
create trigger capture_purchase_pricing
  before insert or update on public.achats
  for each row execute function private.capture_purchase_pricing();

commit;
