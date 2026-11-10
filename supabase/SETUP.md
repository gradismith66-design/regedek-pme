# Mise en service de REGEDEK PME

## Configuration du déploiement

Dans les variables d’environnement Vercel, ajoute ces variables en Production, Preview et Development :

- `VITE_SUPABASE_URL` : URL du projet Supabase.
- `VITE_SUPABASE_PUBLISHABLE_KEY` : clé publishable du projet. N’ajoute jamais une clé `service_role` ou `sb_secret_*` dans Vercel côté navigateur.

Après leur ajout, redéploie l’application. Le fichier `.env.local` sert uniquement au développement local et n’est pas suivi par Git.

Dans Supabase Auth, ajoute le domaine de production Vercel à la liste des URL de redirection autorisées. Pour la mise en service, désactive les inscriptions publiques et crée/invite les comptes de la régie depuis le tableau de bord Supabase. L’application ne propose pas d’inscription publique.

Configure un SMTP institutionnel pour l’envoi fiable des liens de récupération de mot de passe.

## Premier administrateur

1. Crée ou invite le compte du premier administrateur dans **Authentication > Users**.
2. Dans le SQL Editor, remplace l’adresse ci-dessous par celle du compte créé, puis exécute :

```sql
insert into public.staff_profiles (user_id, role)
select id, 'admin'
from auth.users
where lower(email) = lower('admin@regedek.cd')
on conflict (user_id) do update set role = excluded.role;
```

3. Ajoute les autres comptes depuis **Authentication > Users**, puis attribue un profil dans `staff_profiles` avec l’un des rôles suivants :

- `admin` : consultation, modification et suppression ; gestion des règles de statut.
- `agent` : consultation, création et modification ; pas de suppression ni de changement des règles.
- `reader` : consultation seulement.

Les comptes sans ligne dans `staff_profiles` ne peuvent pas lire les données. La base applique les mêmes droits via RLS ; masquer un bouton dans l’interface ne constitue pas le contrôle d’accès.

