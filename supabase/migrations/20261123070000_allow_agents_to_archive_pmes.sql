begin;

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
        'pme.read', 'pme.create', 'pme.update', 'pme.archive', 'pme.dossier.manage',
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

commit;
