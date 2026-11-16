create index if not exists pme_authorization_history_actor_id_idx on public.pme_authorization_history(actor_id);
create index if not exists pme_documents_created_by_idx on public.pme_documents(created_by);
create index if not exists pme_documents_reviewed_by_idx on public.pme_documents(reviewed_by);
create index if not exists pme_dossier_history_actor_id_idx on public.pme_dossier_history(actor_id);
create index if not exists pme_dossier_history_document_id_idx on public.pme_dossier_history(document_id);
create index if not exists pmes_authorization_agent_id_idx on public.pmes(authorization_agent_id);
create index if not exists pmes_dossier_updated_by_idx on public.pmes(dossier_updated_by);
