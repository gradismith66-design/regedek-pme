alter table public.pmes drop constraint pmes_nb_autorisations_check;
alter table public.pmes add constraint pmes_nb_autorisations_check check (nb_autorisations >= 0);

