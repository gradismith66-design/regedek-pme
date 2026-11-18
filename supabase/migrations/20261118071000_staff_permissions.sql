begin;

alter table public.staff_profiles
  drop constraint if exists staff_profiles_role_check;
alter table public.staff_profiles
  add constraint staff_profiles_role_check
  check (role in ('admin', 'agent', 'reader', 'custom', 'disabled'));

create table if not exists private.staff_permission_catalog (
  permission text primary key,
  label text not null
);

insert into private.staff_permission_catalog(permission, label) values
  ('pme.read', 'Consulter les PME'),
  ('pme.create', 'Créer une PME'),
  ('pme.update', 'Modifier une PME'),
  ('pme.archive', 'Archiver et restaurer une PME'),
  ('pme.dossier.manage', 'Gérer le suivi des dossiers'),
  ('pme.authorization.manage', 'Gérer les autorisations et agréments'),
  ('purchase.read', 'Consulter les achats'),
  ('purchase.create', 'Créer un achat'),
  ('purchase.update', 'Modifier un achat'),
  ('purchase.delete', 'Supprimer un achat'),
  ('document.read', 'Consulter les pièces justificatives'),
  ('document.upload', 'Importer des pièces justificatives'),
  ('document.update', 'Modifier les pièces justificatives'),
  ('document.review', 'Valider ou rejeter les pièces'),
  ('document.delete', 'Supprimer les pièces justificatives'),
  ('inspection.read', 'Consulter les inspections'),
  ('inspection.create', 'Créer un rapport d’inspection'),
  ('settings.read', 'Consulter les paramètres'),
  ('settings.update', 'Modifier les paramètres sensibles'),
  ('staff.manage', 'Gérer les comptes et les rôles'),
  ('reports.read', 'Consulter et télécharger les rapports'),
  ('activity.read', 'Consulter les activités des utilisateurs')
on conflict (permission) do update set label = excluded.label;

create table if not exists private.staff_permission_grants (
  user_id uuid not null references public.staff_profiles(user_id) on delete cascade,
  permission text not null references private.staff_permission_catalog(permission) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, permission)
);

alter table private.staff_permission_catalog enable row level security;
alter table private.staff_permission_grants enable row level security;
revoke all on private.staff_permission_catalog, private.staff_permission_grants from public, anon, authenticated;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_profiles s
    join auth.users u on u.id = s.user_id
    where s.user_id = (select auth.uid())
      and s.role = 'admin'
      and lower(u.email) = 'gradismith66@gmail.com'
  )
$$;
revoke all on function private.is_super_admin() from public, anon, authenticated;

create or replace function private.current_staff_permissions()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case s.role
      when 'admin' then case
        when private.is_super_admin() then array(
          select c.permission from private.staff_permission_catalog c order by c.permission
        )
        else array[]::text[]
      end
      when 'agent' then array[
        'pme.read', 'pme.create', 'pme.update', 'pme.dossier.manage',
        'pme.authorization.manage', 'purchase.read', 'purchase.create',
        'purchase.update', 'document.read', 'document.upload',
        'document.update', 'document.review', 'inspection.read',
        'inspection.create', 'settings.read'
      ]::text[]
      when 'reader' then array[
        'pme.read', 'purchase.read', 'document.read', 'inspection.read', 'settings.read'
      ]::text[]
      when 'custom' then array(
        select permission
        from (
          values ('pme.read'), ('purchase.read'), ('document.read'), ('inspection.read'), ('settings.read')
          union
          select g.permission
          from private.staff_permission_grants g
          where g.user_id = s.user_id
        ) available(permission)
        order by permission
      )
      else array[]::text[]
    end,
    array[]::text[]
  )
  from public.staff_profiles s
  where s.user_id = (select auth.uid())
$$;

create or replace function private.staff_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_permission = any(private.current_staff_permissions()), false)
$$;

revoke all on function private.current_staff_permissions() from public, anon, authenticated;
revoke all on function private.staff_has_permission(text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_staff_permissions() to authenticated;
grant execute on function private.staff_has_permission(text) to authenticated;

create or replace function public.my_permissions()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_staff_permissions()
$$;
revoke all on function public.my_permissions() from public, anon;
grant execute on function public.my_permissions() to authenticated;

create or replace function public.set_pme_archived(p_pme_id bigint, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.staff_has_permission('pme.archive') then
    raise exception 'Le rôle courant ne permet pas d’archiver ou de restaurer une PME.';
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

drop policy if exists "Staff can read registry" on public.pmes;
create policy "Staff can read registry"
  on public.pmes for select to authenticated
  using (
    private.staff_has_permission('pme.read')
    and (archived_at is null or private.staff_has_permission('pme.archive'))
  );
drop policy if exists "Agents can create registry records" on public.pmes;
create policy "Agents can create registry records"
  on public.pmes for insert to authenticated
  with check (archived_at is null and private.staff_has_permission('pme.create'));
drop policy if exists "Agents can update registry records" on public.pmes;
create policy "Agents can update registry records"
  on public.pmes for update to authenticated
  using (
    archived_at is null
    and (
      private.staff_has_permission('pme.update')
      or private.staff_has_permission('pme.dossier.manage')
      or private.staff_has_permission('pme.authorization.manage')
    )
  )
  with check (
    archived_at is null
    and (
      private.staff_has_permission('pme.update')
      or private.staff_has_permission('pme.dossier.manage')
      or private.staff_has_permission('pme.authorization.manage')
    )
  );
drop policy if exists "Admins can delete registry records" on public.pmes;
revoke delete on public.pmes from public, anon, authenticated;

drop policy if exists "Staff can read purchases" on public.achats;
create policy "Staff can read purchases"
  on public.achats for select to authenticated
  using (private.staff_has_permission('purchase.read'));
drop policy if exists "Agents can create purchases" on public.achats;
create policy "Agents can create purchases"
  on public.achats for insert to authenticated
  with check (private.staff_has_permission('purchase.create'));
drop policy if exists "Agents can update purchases" on public.achats;
create policy "Agents can update purchases"
  on public.achats for update to authenticated
  using (private.staff_has_permission('purchase.update'))
  with check (private.staff_has_permission('purchase.update'));
drop policy if exists "Admins can delete purchases" on public.achats;
create policy "Admins can delete purchases"
  on public.achats for delete to authenticated
  using (private.staff_has_permission('purchase.delete'));

drop policy if exists "Staff can read settings" on public.settings;
create policy "Staff can read settings"
  on public.settings for select to authenticated
  using (private.staff_has_permission('settings.read'));
drop policy if exists "Admins can update settings" on public.settings;
create policy "Admins can update settings"
  on public.settings for update to authenticated
  using (private.staff_has_permission('settings.update'))
  with check (private.staff_has_permission('settings.update'));

drop policy if exists "Staff read PME documents" on public.pme_documents;
create policy "Staff read PME documents" on public.pme_documents for select to authenticated
  using (private.staff_has_permission('document.read'));
drop policy if exists "Agents manage PME documents" on public.pme_documents;
create policy "Agents manage PME documents" on public.pme_documents for insert to authenticated
  with check (private.staff_has_permission('document.upload'));
drop policy if exists "Agents update PME documents" on public.pme_documents;
create policy "Agents update PME documents" on public.pme_documents for update to authenticated
  using (
    private.staff_has_permission('document.update')
    or private.staff_has_permission('document.review')
  )
  with check (
    private.staff_has_permission('document.update')
    or private.staff_has_permission('document.review')
  );
drop policy if exists "Admins delete PME documents" on public.pme_documents;
create policy "Admins delete PME documents" on public.pme_documents for delete to authenticated
  using (private.staff_has_permission('document.delete'));

drop policy if exists "Staff read dossier history" on public.pme_dossier_history;
create policy "Staff read dossier history" on public.pme_dossier_history for select to authenticated
  using (private.staff_has_permission('pme.read'));
drop policy if exists "Staff read authorization history" on public.pme_authorization_history;
create policy "Staff read authorization history" on public.pme_authorization_history for select to authenticated
  using (private.staff_has_permission('pme.read'));

drop policy if exists "Staff read inspection reports" on public.pme_inspection_reports;
create policy "Staff read inspection reports" on public.pme_inspection_reports for select to authenticated
  using (private.staff_has_permission('inspection.read'));
drop policy if exists "Agents report pending inspections" on public.pme_inspection_reports;
create policy "Agents report pending inspections" on public.pme_inspection_reports for insert to authenticated
  with check (
    inspector_id = (select auth.uid())
    and private.staff_has_permission('inspection.create')
    and exists (
      select 1 from public.pmes p
      where p.id = pme_id and p.authorization_status = 'EN_ATTENTE_INSPECTION'
    )
  );

drop policy if exists "Staff read PME document files" on storage.objects;
create policy "Staff read PME document files" on storage.objects for select to authenticated
  using (bucket_id = 'pme-documents' and private.staff_has_permission('document.read'));
drop policy if exists "Agents upload PME document files" on storage.objects;
create policy "Agents upload PME document files" on storage.objects for insert to authenticated
  with check (bucket_id = 'pme-documents' and private.staff_has_permission('document.upload'));
drop policy if exists "Agents update PME document files" on storage.objects;
create policy "Agents update PME document files" on storage.objects for update to authenticated
  using (bucket_id = 'pme-documents' and private.staff_has_permission('document.upload'))
  with check (bucket_id = 'pme-documents' and private.staff_has_permission('document.upload'));
drop policy if exists "Admins delete PME document files" on storage.objects;
create policy "Admins delete PME document files" on storage.objects for delete to authenticated
  using (bucket_id = 'pme-documents' and private.staff_has_permission('document.delete'));

create or replace function private.audit_pme_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if new.dossier_status is distinct from old.dossier_status
     or new.dossier_observations is distinct from old.dossier_observations then
    new.dossier_updated_at := now();
    new.dossier_updated_by := actor;
    insert into public.pme_dossier_history(pme_id,event_type,old_status,new_status,observations,actor_id)
    values (
      new.id,
      case when new.dossier_status is distinct from old.dossier_status then 'STATUT_DOSSIER' else 'OBSERVATION_DOSSIER' end,
      old.dossier_status,new.dossier_status,new.dossier_observations,actor
    );
  end if;

  if new.authorization_status is distinct from old.authorization_status
     or new.authorization_reference is distinct from old.authorization_reference
     or new.authorization_issue_date is distinct from old.authorization_issue_date
     or new.authorization_expiry_date is distinct from old.authorization_expiry_date
     or new.authorization_observations is distinct from old.authorization_observations
     or new.non_compliance_reason is distinct from old.non_compliance_reason
     or new.authority_signer_name is distinct from old.authority_signer_name
     or new.authority_signer_title is distinct from old.authority_signer_title then
    if not private.staff_has_permission('pme.authorization.manage')
       and not (
         actor is null
         and old.authorization_status = 'AUTORISE'
         and new.authorization_status = 'EXPIRE'
         and old.authorization_expiry_date < (now() at time zone 'Africa/Kinshasa')::date
         and new.authorization_change_reason = 'Expiration automatique après la date de validité.'
       ) then
      raise exception 'Le rôle courant ne permet pas de modifier les autorisations.';
    end if;
    if new.authorization_status = 'AUTORISE' and (
      length(trim(new.authorization_reference)) = 0 or new.authorization_issue_date is null
      or new.authorization_expiry_date is null or new.authorization_expiry_date < new.authorization_issue_date
      or length(trim(new.authority_signer_name)) = 0 or length(trim(new.authority_signer_title)) = 0
    ) then
      raise exception 'Une autorisation officielle exige une référence, les dates cohérentes et l’identité/fonction du signataire.';
    end if;
    if new.authorization_status = 'NON_CONFORME' and length(trim(new.non_compliance_reason)) = 0 then
      raise exception 'Le motif de non-conformité est obligatoire.';
    end if;
    if new.authorization_status is distinct from old.authorization_status
       and length(trim(new.authorization_change_reason)) = 0 then
      raise exception 'Le motif du changement de statut d’autorisation est obligatoire.';
    end if;
    new.authorization_updated_at := now();
    new.authorization_agent_id := actor;
    insert into public.pme_authorization_history(
      pme_id,old_status,new_status,reason,authorization_reference,issue_date,expiry_date,
      observations,signer_name,signer_title,actor_id
    ) values (
      new.id,old.authorization_status,new.authorization_status,new.authorization_change_reason,
      new.authorization_reference,new.authorization_issue_date,new.authorization_expiry_date,
      new.authorization_observations,new.authority_signer_name,new.authority_signer_title,actor
    );
  end if;
  return new;
end;
$$;
revoke all on function private.audit_pme_admin_change() from public, anon, authenticated;

create or replace function private.guard_pme_edit_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.staff_has_permission('pme.update')
     and (to_jsonb(new) - array[
       'dossier_status', 'dossier_observations', 'dossier_updated_at', 'dossier_updated_by',
       'authorization_status', 'authorization_updated_at', 'authorization_agent_id',
       'authorization_reference', 'authorization_issue_date', 'authorization_expiry_date',
       'authorization_observations', 'non_compliance_reason', 'authorization_change_reason',
       'authority_signer_name', 'authority_signer_title', 'archived_at', 'updated_at'
     ]) is distinct from (to_jsonb(old) - array[
       'dossier_status', 'dossier_observations', 'dossier_updated_at', 'dossier_updated_by',
       'authorization_status', 'authorization_updated_at', 'authorization_agent_id',
       'authorization_reference', 'authorization_issue_date', 'authorization_expiry_date',
       'authorization_observations', 'non_compliance_reason', 'authorization_change_reason',
       'authority_signer_name', 'authority_signer_title', 'archived_at', 'updated_at'
     ]) then
    raise exception 'Le rôle courant ne permet pas de modifier les informations générales de la PME.';
  end if;
  if (new.dossier_status is distinct from old.dossier_status
      or new.dossier_observations is distinct from old.dossier_observations)
     and not private.staff_has_permission('pme.dossier.manage') then
    raise exception 'Le rôle courant ne permet pas de modifier le dossier administratif.';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_pme_edit_permissions() from public, anon, authenticated;
drop trigger if exists pmes_permission_guard on public.pmes;
create trigger pmes_permission_guard before update on public.pmes
  for each row execute function private.guard_pme_edit_permissions();

create or replace function public.admin_list_staff()
returns table (
  user_id uuid,
  email text,
  role text,
  email_confirmed boolean,
  permissions text[],
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_super_admin() then
    raise exception 'Seul le Super Admin peut gérer les comptes.';
  end if;

  return query
  select u.id, u.email::text, s.role, u.email_confirmed_at is not null,
    coalesce(array_agg(g.permission order by g.permission) filter (where g.permission is not null), array[]::text[]),
    u.created_at
  from auth.users u
  left join public.staff_profiles s on s.user_id = u.id
  left join private.staff_permission_grants g on g.user_id = u.id
  where u.email is not null
  group by u.id, u.email, s.role, u.email_confirmed_at, u.created_at
  order by lower(u.email);
end;
$$;
revoke all on function public.admin_list_staff() from public, anon;
grant execute on function public.admin_list_staff() to authenticated;

create or replace function public.admin_set_staff_role(p_email text, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  normalized_email text := lower(trim(p_email));
begin
  if not private.is_super_admin() then
    raise exception 'Seul le Super Admin peut modifier les rôles.';
  end if;
  if p_role not in ('admin', 'agent', 'reader', 'custom', 'disabled') then
    raise exception 'Rôle invalide.';
  end if;
  if normalized_email = 'gradismith66@gmail.com' and p_role <> 'admin' then
    raise exception 'Le compte du Super Admin principal ne peut pas être désactivé ni rétrogradé.';
  end if;
  if p_role = 'admin' and normalized_email <> 'gradismith66@gmail.com' then
    raise exception 'Le rôle Super Admin est réservé à gradismith66@gmail.com.';
  end if;

  select u.id into target_user_id
  from auth.users u
  where lower(u.email) = normalized_email;
  if target_user_id is null then
    raise exception 'Aucun utilisateur Auth ne correspond à cette adresse.';
  end if;

  insert into public.staff_profiles(user_id, role)
  values (target_user_id, p_role)
  on conflict (user_id) do update set role = excluded.role;

  if p_role <> 'custom' then
    delete from private.staff_permission_grants where user_id = target_user_id;
  end if;
end;
$$;
revoke all on function public.admin_set_staff_role(text, text) from public, anon;
grant execute on function public.admin_set_staff_role(text, text) to authenticated;

create or replace function public.admin_set_custom_permission(p_email text, p_permission text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  target_role text;
  normalized_email text := lower(trim(p_email));
begin
  if not private.is_super_admin() then
    raise exception 'Seul le Super Admin peut modifier les permissions personnalisées.';
  end if;
  if p_permission = 'staff.manage'
     or not exists (select 1 from private.staff_permission_catalog c where c.permission = p_permission) then
    raise exception 'Permission personnalisée invalide.';
  end if;

  select u.id, s.role into target_user_id, target_role
  from auth.users u
  join public.staff_profiles s on s.user_id = u.id
  where lower(u.email) = normalized_email;
  if target_user_id is null or target_role <> 'custom' then
    raise exception 'La permission ne peut être modifiée que pour un compte au rôle personnalisé.';
  end if;

  if p_enabled then
    insert into private.staff_permission_grants(user_id, permission, granted_by)
    values (target_user_id, p_permission, (select auth.uid()))
    on conflict (user_id, permission) do nothing;
  else
    delete from private.staff_permission_grants
    where user_id = target_user_id and permission = p_permission;
  end if;
end;
$$;
revoke all on function public.admin_set_custom_permission(text, text, boolean) from public, anon;
grant execute on function public.admin_set_custom_permission(text, text, boolean) to authenticated;

update public.staff_profiles s
set role = case lower(u.email)
  when 'gradismith66@gmail.com' then 'admin'
  when 'ootshudy@tuta.io' then 'agent'
  when 'franckbienvenulubaki@gmail.com' then 'agent'
  when 'adolphesese4@gmail.com' then 'custom'
  else s.role
end
from auth.users u
where u.id = s.user_id
  and lower(u.email) in (
    'gradismith66@gmail.com',
    'ootshudy@tuta.io',
    'franckbienvenulubaki@gmail.com',
    'adolphesese4@gmail.com'
  );

commit;
