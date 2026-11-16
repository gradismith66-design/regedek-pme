# Mise en service de REGEDEK PME

## Configuration du déploiement

Dans les variables d’environnement Vercel, ajoute ces variables en Production, Preview et Development :

- `VITE_SUPABASE_URL` : URL du projet Supabase.
- `VITE_SUPABASE_PUBLISHABLE_KEY` : clé publishable du projet. N’ajoute jamais une clé `service_role` ou `sb_secret_*` dans Vercel côté navigateur.

Après leur ajout, redéploie l’application. Le fichier `.env.local` sert uniquement au développement local et n’est pas suivi par Git.

## Acces a l'application

L'application demande une session Supabase et un profil dans `staff_profiles`. La migration `20261113093524_allow_public_registry_read.sql` avait active la lecture publique; la migration `20261113095326_restrict_app_access_bootstrap_admin.sql` la retire et remet la lecture sous les politiques du personnel. La migration `20261113093555_sync_verified_sheet_data.sql` synchronise les donnees verifiees et `20261113093537_sync_pdf_registry_names.sql` corrige les trois noms du PDF.

Dans Supabase Auth, autorise les URL de retour de l'application, notamment le domaine de production et `http://localhost:5173`. Active la confirmation des adresses e-mail. Configure un SMTP institutionnel pour l'envoi des confirmations et des liens de reinitialisation.

Les visiteurs peuvent voir la page de connexion, mais les tables PME, achats et reglages ne sont plus lisibles par le role `anon`. Un compte authentifie sans profil personnel reste bloque hors du registre.

## Premier administrateur

1. Ouvre l'application et choisis **Initialiser le premier compte admin**. Cette option n'apparait que tant qu'aucun profil personnel n'existe.
2. La page n'accepte que `gradismith66@gmail.com`, configure dans la migration `20261113095326_restrict_app_access_bootstrap_admin.sql`. Cree le compte avec un mot de passe, puis confirme l'adresse depuis le lien envoye par Supabase. Le role `admin` est attribue automatiquement apres confirmation.
3. L'initialisation est atomique et ne peut etre utilisee qu'une seule fois. Les appels RPC verifies cote base refusent les autres adresses et les sessions non confirmees.
4. Pour ajouter les autres agents/lecteurs, cree leurs comptes dans **Authentication > Users**, puis attribue un profil dans `staff_profiles` :

```sql
insert into public.staff_profiles (user_id, role)
select id, 'reader'
from auth.users
where lower(email) = lower('agent@regedek.cd')
on conflict (user_id) do update set role = excluded.role;
```

- `admin` : consultation, modification et suppression ; gestion des regles de statut.
- `agent` : consultation, creation et modification ; pas de suppression ni de changement des regles.
- `reader` : consultation seulement.

## Suivi administratif des PME

Applique les migrations `20261116115735` a `20261116122215` dans l'ordre. Elles ajoutent des statuts distincts pour le dossier et pour l'autorisation, les documents, les rapports append-only, les historiques, le stockage prive et la tache quotidienne d'expiration. Les PME existantes passent en `EN_COURS_DE_VERIFICATION` et `EN_ETUDE_ADMINISTRATIVE`; aucune autorisation n'est deduite des anciennes dates ou de la completude des dossiers. Les nouveaux dossiers commencent en `DOSSIER_NON_SOUMIS` et `EN_ETUDE_ADMINISTRATIVE`.

Dans les roles actuels du projet, `agent` peut gerer le dossier, les documents et ajouter un rapport d'inspection append-only lorsque la PME est en attente d'inspection; seul `admin` peut changer une decision d'autorisation. Pour passer a `AUTORISE`, la reference, les dates coherentes, le nom et la fonction du signataire ainsi que le motif de decision sont obligatoires. Les fichiers sont conserves dans le bucket prive `pme-documents` et controles par les politiques Storage/RLS. La generation de l'attestation n'est disponible qu'une fois la decision officielle enregistree; son QR renvoie a la page publique de verification, qui ne montre que les champs publics de l'autorisation. L'image QR est generee par le service public api.qrserver.com avec uniquement cette URL de verification contenant le jeton aleatoire.

## Verification de la configuration de production

La configuration locale actuelle pointe vers le projet Supabase `gtwmzhzwhgolexelvola`, tandis que les variables Vercel Production, Preview et Development pointent vers `rrruitwhdujrljmmzash`. Le connecteur Supabase disponible ne donne acces qu'au premier projet. Ne publie pas les ecrans de suivi tant que le projet Supabase qui contient les PME de production n'est pas confirme et que ces migrations n'y sont pas appliquees. Ne remplace pas ses variables par celles d'une base vide sans avoir verifie le jeu de donnees.
