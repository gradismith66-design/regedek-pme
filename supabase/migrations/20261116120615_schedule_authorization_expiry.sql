begin;

-- Preserve decisions and dossier history even when an administrator attempts to
-- delete a PME. History is append-only from the application roles.
alter table public.pme_dossier_history drop constraint if exists pme_dossier_history_pme_id_fkey;
alter table public.pme_dossier_history add constraint pme_dossier_history_pme_id_fkey
  foreign key (pme_id) references public.pmes(id) on delete restrict;
alter table public.pme_authorization_history drop constraint if exists pme_authorization_history_pme_id_fkey;
alter table public.pme_authorization_history add constraint pme_authorization_history_pme_id_fkey
  foreign key (pme_id) references public.pmes(id) on delete restrict;

create or replace function private.audit_pme_initial_state()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.pme_dossier_history(pme_id,event_type,new_status,observations,actor_id)
  values (new.id,'INITIALISATION_DOSSIER',new.dossier_status,new.dossier_observations,auth.uid());
  insert into public.pme_authorization_history(pme_id,new_status,reason,authorization_reference,issue_date,expiry_date,observations,signer_name,signer_title,actor_id)
  values (new.id,new.authorization_status,'Statut initial : aucune décision d’autorisation présumée.',new.authorization_reference,new.authorization_issue_date,new.authorization_expiry_date,new.authorization_observations,new.authority_signer_name,new.authority_signer_title,auth.uid());
  return new;
end;
$$;
revoke all on function private.audit_pme_initial_state() from public, anon, authenticated;
drop trigger if exists pmes_initial_state_audit on public.pmes;
create trigger pmes_initial_state_audit after insert on public.pmes
  for each row execute function private.audit_pme_initial_state();

create extension if not exists pg_cron with schema pg_catalog;

create or replace function private.expire_pme_authorizations()
returns integer language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  update public.pmes
  set authorization_status = 'EXPIRE',
      authorization_change_reason = 'Expiration automatique après la date de validité.'
  where authorization_status = 'AUTORISE'
    and authorization_expiry_date < (now() at time zone 'Africa/Kinshasa')::date;
  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke all on function private.expire_pme_authorizations() from public, anon, authenticated;

drop function if exists public.refresh_expired_authorizations();
select cron.unschedule(jobid) from cron.job where jobname = 'regedek-pme-expire-authorizations';
select cron.schedule(
  'regedek-pme-expire-authorizations',
  '0 23 * * *',
  'select private.expire_pme_authorizations();'
);

commit;
