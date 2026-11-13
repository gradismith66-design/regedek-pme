# Mise en service de REGEDEK PME

## Configuration du déploiement

Dans les variables d’environnement Vercel, ajoute ces variables en Production, Preview et Development :

- `VITE_SUPABASE_URL` : URL du projet Supabase.
- `VITE_SUPABASE_PUBLISHABLE_KEY` : clé publishable du projet. N’ajoute jamais une clé `service_role` ou `sb_secret_*` dans Vercel côté navigateur.

Après leur ajout, redéploie l’application. Le fichier `.env.local` sert uniquement au développement local et n’est pas suivi par Git.

## Consultation publique du registre

La migration `20261113093524_allow_public_registry_read.sql` autorise la lecture sans connexion des PME, des achats et des règles de statut. La migration `20261113093555_sync_verified_sheet_data.sql` ajoute les dates d'agrément et d'autorisation vérifiées ainsi que l'achat manquant de NEW SEPRONAC. La migration `20261113093537_sync_pdf_registry_names.sql` corrige les trois noms des PME selon le PDF. Applique toutes les migrations au projet Supabase avant de déployer cette version.

Cela rend publiques les informations présentes dans ces tables, notamment les noms, coordonnées et adresses des PME ainsi que l’historique des achats. Les visiteurs non connectés ne reçoivent aucun droit d’écriture. Les droits de modification des comptes du personnel restent gérés par les politiques RLS existantes.

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

Les données du registre sont publiquement lisibles, y compris par les comptes sans ligne dans `staff_profiles`. Les opérations d’écriture restent soumises aux rôles et politiques RLS ; masquer un bouton dans l’interface ne constitue pas le contrôle d’accès.
