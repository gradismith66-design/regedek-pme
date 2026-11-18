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
4. Applique les migrations `20261118063000_protect_pme_relations.sql`, `20261118071000_staff_permissions.sql`, `20261118074000_staff_activity_log.sql`, puis `20261118080000_purchase_reporting.sql`, apres avoir verifie le projet cible. Le script des permissions attribue les profils `admin`, `agent` et `custom` aux adresses configurees si elles existent deja dans Supabase Auth; il ne cree pas de comptes.
5. Deploie l'Edge Function d'invitation avec `supabase functions deploy manage-staff`. Elle utilise `SUPABASE_SERVICE_ROLE_KEY` uniquement cote serveur; ne place jamais cette cle dans Vite, Vercel Environment Variables `VITE_*`, ni dans le code client. Si les liens d'invitation doivent revenir vers un domaine particulier, configure le secret serveur `SUPABASE_AUTH_REDIRECT_URL` avec une URL autorisee dans Supabase Auth.
6. Dans **Utilisateurs**, le Super Admin peut inviter des comptes, attribuer les roles et donner des permissions personnalisees. Les nouveaux utilisateurs doivent confirmer leur adresse avant connexion.
7. Dans **Activites**, le Super Admin peut filtrer le journal append-only par adresse e-mail, type d'operation et periode. Les operations PME, achats, documents, inspections et changements de roles sont journalisees par des declencheurs SQL; les nouvelles activites sont aussi signalees en temps reel. L'acces au journal est limite par RLS a la permission `activity.read`.

- `admin` (Super Admin) : tous les droits; le compte principal `gradismith66@gmail.com` ne peut pas etre retrograde.
- `agent` (Operateur) : gestion operationnelle des PME, dossiers, autorisations, achats, documents et inspections, sans gestion des roles, archivage, suppression d'achats ou changement des parametres sensibles.
- `custom` : lecture seule par defaut; le Super Admin peut accorder des permissions individuelles.
- `reader` : consultation seulement; `disabled` : aucun acces a l'application.

Les permissions sont verifiees par des fonctions SQL et les politiques RLS. Les controles de l'interface ne remplacent pas ces verifications cote base.

## Suivi administratif des PME

Applique les migrations `20261116115735` a `20261116122215` dans l'ordre. Elles ajoutent des statuts distincts pour le dossier et pour l'autorisation, les documents, les rapports append-only, les historiques, le stockage prive et la tache quotidienne d'expiration. Les PME existantes passent en `EN_COURS_DE_VERIFICATION` et `EN_ETUDE_ADMINISTRATIVE`; aucune autorisation n'est deduite des anciennes dates ou de la completude des dossiers. Les nouveaux dossiers commencent en `DOSSIER_NON_SOUMIS` et `EN_ETUDE_ADMINISTRATIVE`.

Dans les roles actuels du projet, `agent` peut gerer le dossier, les documents et ajouter un rapport d'inspection append-only lorsque la PME est en attente d'inspection; seul `admin` peut changer une decision d'autorisation. Pour passer a `AUTORISE`, la reference, les dates coherentes, le nom et la fonction du signataire ainsi que le motif de decision sont obligatoires. Les fichiers sont conserves dans le bucket prive `pme-documents` et controles par les politiques Storage/RLS. La generation de l'attestation n'est disponible qu'une fois la decision officielle enregistree; son QR renvoie a la page publique de verification, qui ne montre que les champs publics de l'autorisation. L'image QR est generee par le service public api.qrserver.com avec uniquement cette URL de verification contenant le jeton aleatoire.

Dans une fiche PME, la selection multiple enregistre une ligne documentaire par fichier. Les apercus d'image et les consultations utilisent des URL signees temporaires du bucket prive. Le remplacement et la suppression sont soumis aux permissions de document; une confirmation est demandee avant le remplacement ou la suppression.

Les PME ayant deja des evenements d'audit ne peuvent pas etre supprimees physiquement: leurs historiques sont conserves. Applique aussi la migration `20261118063000_protect_pme_relations.sql`: elle interdit la suppression physique et remplace les cascades PME -> achats/documents/inspections par des contraintes `RESTRICT`, sans supprimer de lignes existantes. L'archivage/restauration reserve a l'administrateur conserve les achats, documents, rapports et historiques; seuls les administrateurs peuvent lire les PME archivees.

## Achats et rapports

La migration `20261118080000_purchase_reporting.sql` ajoute la designation, l'unite, le prix unitaire et la devise `CDF` ou `USD` aux achats. Le montant total est calcule par la base a partir de la quantite existante et du prix unitaire. Les achats historiques sont conserves avec leurs champs de prix vides; ils peuvent etre completes manuellement dans **Achats > Modifier**. Aucun montant historique n'est deduit automatiquement.

L'onglet **Rapports** est protege par `reports.read`. Les classeurs Excel contiennent des feuilles distinctes pour le rapport global. L'export PDF ouvre la fenetre d'impression du navigateur; choisir **Enregistrer au format PDF**. L'attribution d'un administrateur dans les rapports s'appuie sur le journal SQL et reste indiquee comme non renseignee lorsque l'operation historique n'avait pas ete journalisee. La RPC `report_activity` ne retourne pas les details sensibles du journal et limite la reponse aux 10 000 operations les plus recentes.

## Verification de la configuration de production

La configuration locale actuelle pointe vers le projet Supabase `gtwmzhzwhgolexelvola`, tandis que les variables Vercel Production, Preview et Development pointent vers `rrruitwhdujrljmmzash`. Le connecteur Supabase disponible ne donne acces qu'au premier projet. Ne publie pas les ecrans de suivi tant que le projet Supabase qui contient les PME de production n'est pas confirme et que ces migrations n'y sont pas appliquees. Ne remplace pas ses variables par celles d'une base vide sans avoir verifie le jeu de donnees.
