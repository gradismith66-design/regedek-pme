begin;

-- Corrections de fautes de saisie et d'OCR. Chaque mise à jour vérifie
-- l'identifiant et l'ancienne valeur afin de préserver les autres dossiers.
update public.pmes
set quartiers = '7e rue résidentielle'
where id = 7 and nom = 'AEDEC' and quartiers like '7e%rue%';

update public.pmes
set adresse = 'Appart A11, 37 av. Mpolo Maurice, C/Gombe'
where id = 10 and nom = 'AKINET'
  and adresse = 'Appart A11 37 Av Mpolo Maurice C/ Gombe | Appart A11 37 Av Mpolo Maurice C/ TG5ombe';

update public.pmes
set contact = 'Coordonnateur'
where id = 19 and nom = 'COUNTRY SHINE' and contact = 'Cordinateur';

update public.pmes
set adresse = '01, av. Saint-Christophe, C/Limete, Q/1re rue'
where id = 22 and nom = 'KPS' and adresse = '01, av: Saint christophe; C/Limete; Q/1ere rue';

update public.pmes
set contact = 'Coordonnateur'
where id = 23 and nom = 'GB SERVICES' and contact = 'coordonateur';

update public.pmes
set adresse = '24/57, av. 13e rue, C/Selembao, Q/Cité-Verte'
where id = 26 and nom = 'INTEGRITY HIGH GROUP SARL'
  and adresse like '24/57%13%rue%C/Selembao%';

update public.pmes
set adresse = '10270, av. Vénus, C/Limete, Q/7e rue résidentielle'
where id = 27 and nom = 'AARON NZANGI'
  and adresse like '10270%Venus%C/Limete%7eme rue%';

update public.pmes
set quartiers = replace(quartiers, 'huillerie', 'Huilerie')
where id = 27 and nom = 'AARON NZANGI' and quartiers ilike '%huillerie%';

update public.pmes
set tel = '+243815955243 / +243999998902',
    adresse = '4006, av. Cadastre, C/Barumbu, Q/Bon Marché'
where id = 35 and nom = 'BONTE DIVINE'
  and tel like '%999998902%'
  and adresse like '4006%Cadastre%';

update public.pmes
set adresse = '34, av. de la Paix, Q/Maman Mobutu, C/Mont-Ngafula, Q/Dimez'
where id = 45 and nom = 'EBS SERVICE'
  and adresse = '34, av: de la paix; Q. Maman Mobutu, C/Mont-Ngafula; Q/Dime8z';

update public.pmes
set nom = 'OUSAFI SERVICE'
where id = 51 and nom = 'OUSAFI SERIVCE';

update public.pmes
set adresse = '6, av. Militant, Q/Funa, C/Barumbu',
    quartiers = 'Sainte-Anne, derrière l''ambassade des États-Unis, boulevard du 30 juin, immeuble Interfina, avenue de l''Équateur chez Global'
where id = 62 and nom = 'DIVINE TRADING SOCIETY SARL'
  and adresse = '6, AV MILITANT, Q. FUNA, C/B0A0R3U36M5B2U035119,';

update public.pmes
set nom = 'PERFORMANCE SERVICE'
where id = 78 and nom = 'PERFORMENCE SERVICE';

update public.pmes
set adresse = '151, av. 3e rue, C/Matete'
where id = 82 and nom = 'BIETHA' and adresse = '151, av: 3eme rue; C/Matete';

update public.pmes
set quartiers = 'Gombe, Q/Clinique Kintambo, Q/Basoko, Limete, Q/Industriel et Kingabwa'
where id = 29 and nom = 'POKIMAS' and quartiers ilike '%limet_%';

update public.pmes
set quartiers = 'Limete industrielle'
where id = 33 and nom = 'GROUPE KIN LA BELLE SERVICE POUBELLE' and quartiers = 'Limite industrielle';

update public.pmes
set adresse = 'av. de la Grâce, C/Gombe, Q/Haut-Commandement'
where id = 89 and nom = 'HOPE' and adresse ilike 'av:%la grace%';

update public.pmes
set nom = 'JOURNÉE MONDIALE DE L''ENVIRONNEMENT'
where id = 92 and nom = 'JRNEE MONDIALE DE L''ENVIRONNEMENT';

update public.pmes
set adresse = '23, av. 10e rue, C/Limete, Q/Industriel'
where id = 94 and nom = 'FRAPPE DUNGA' and adresse = '23, av: 10 eme rue; C/Limete; Q/Industriel';

commit;
