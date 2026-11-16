begin;

revoke all on public.pme_dossier_history, public.pme_authorization_history from public, anon;
revoke insert, update, delete on public.pme_dossier_history, public.pme_authorization_history from authenticated;
grant select on public.pme_dossier_history, public.pme_authorization_history to authenticated;

revoke all on public.pme_inspection_reports from public, anon;
revoke update, delete on public.pme_inspection_reports from authenticated;
grant select, insert on public.pme_inspection_reports to authenticated;

commit;
