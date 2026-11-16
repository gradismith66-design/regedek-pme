create or replace function private.audit_pme_admin_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if new.dossier_status is distinct from old.dossier_status
     or new.dossier_observations is distinct from old.dossier_observations then
    new.dossier_updated_at := now();
    new.dossier_updated_by := actor;
    insert into public.pme_dossier_history(pme_id,event_type,old_status,new_status,observations,actor_id)
    values (new.id, case when new.dossier_status is distinct from old.dossier_status then 'STATUT_DOSSIER' else 'OBSERVATION_DOSSIER' end,
      old.dossier_status,new.dossier_status,new.dossier_observations,actor);
  end if;

  if new.authorization_status is distinct from old.authorization_status
     or new.authorization_reference is distinct from old.authorization_reference
     or new.authorization_issue_date is distinct from old.authorization_issue_date
     or new.authorization_expiry_date is distinct from old.authorization_expiry_date
     or new.authorization_observations is distinct from old.authorization_observations
     or new.non_compliance_reason is distinct from old.non_compliance_reason
     or new.authority_signer_name is distinct from old.authority_signer_name
     or new.authority_signer_title is distinct from old.authority_signer_title then
    if not exists (select 1 from public.staff_profiles s where s.user_id = actor and s.role = 'admin')
       and not (
         actor is null
         and old.authorization_status = 'AUTORISE'
         and new.authorization_status = 'EXPIRE'
         and old.authorization_expiry_date < (now() at time zone 'Africa/Kinshasa')::date
         and new.authorization_change_reason = 'Expiration automatique après la date de validité.'
       ) then
      raise exception 'Seul un administrateur habilité ou la tâche automatique d’expiration peut modifier une décision d’autorisation.';
    end if;
    if new.authorization_status = 'AUTORISE' and (
      length(trim(new.authorization_reference)) = 0 or new.authorization_issue_date is null
      or new.authorization_expiry_date is null or new.authorization_expiry_date < new.authorization_issue_date
      or length(trim(new.authority_signer_name)) = 0 or length(trim(new.authority_signer_title)) = 0
    ) then raise exception 'Une autorisation officielle exige une référence, des dates cohérentes et l’identité/fonction du signataire.'; end if;
    if new.authorization_status = 'NON_CONFORME' and length(trim(new.non_compliance_reason)) = 0 then raise exception 'Le motif de non-conformité est obligatoire.'; end if;
    if new.authorization_status is distinct from old.authorization_status and length(trim(new.authorization_change_reason)) = 0 then raise exception 'Le motif du changement de statut d’autorisation est obligatoire.'; end if;
    new.authorization_updated_at := now();
    new.authorization_agent_id := actor;
    insert into public.pme_authorization_history(pme_id,old_status,new_status,reason,authorization_reference,issue_date,expiry_date,observations,signer_name,signer_title,actor_id)
    values (new.id,old.authorization_status,new.authorization_status,new.authorization_change_reason,new.authorization_reference,new.authorization_issue_date,new.authorization_expiry_date,new.authorization_observations,new.authority_signer_name,new.authority_signer_title,actor);
  end if;
  return new;
end;
$$;
revoke all on function private.audit_pme_admin_change() from public, anon, authenticated;
