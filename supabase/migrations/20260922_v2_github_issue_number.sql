-- Numéro de l'issue GitHub (pour retrouver le ticket quand GitHub nous prévient d'un changement)
alter table public.annotations add column github_issue_number integer;
create index annotations_github_issue_idx on public.annotations (projet, github_issue_number);
