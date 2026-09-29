-- witmit V2.2 — le fil de messages d'un ticket (28/09/2026)
-- Chaque échange entre l'équipe (commentaire sur l'issue GitHub) et l'auteur du ticket (réponse depuis
-- le tiroir witmit) devient une ligne, datée. Avant, un seul champ message_retour, écrasé à chaque fois.
--   de                : 'equipe' (commentaire GitHub, via github-webhook) ou 'auteur' (réponse, via submit-annotation)
--   rouvre            : ce message accompagnait une réouverture du ticket par son auteur
--   github_comment_id : le commentaire GitHub correspondant — unique, pour ignorer un événement que GitHub renverrait deux fois
-- Même principe que le reste : le navigateur ne fait que LIRE (les messages de ses propres tickets) ; seules
-- les Edge Functions écrivent, avec la clé serveur.
-- La colonne annotations.message_retour est gardée (le widget V2.1 en dépend) et toujours remplie par le webhook.

create table public.messages (
  id                uuid primary key default gen_random_uuid(),
  annotation_id     uuid not null references public.annotations(id) on delete cascade,
  de                text not null check (de in ('auteur', 'equipe')),
  texte             text not null check (char_length(texte) between 1 and 2000),
  rouvre            boolean not null default false,
  github_comment_id bigint,
  cree_le           timestamptz not null default now()
);
create index messages_annotation_idx on public.messages (annotation_id, cree_le);
-- Non partiel (plusieurs NULL restent permis) : nécessaire pour « on conflict (github_comment_id) do nothing ».
create unique index messages_github_comment_idx on public.messages (github_comment_id);

alter table public.messages enable row level security;
create policy "auteur lit les messages de ses tickets" on public.messages
  for select to authenticated
  using (exists (select 1 from public.annotations a where a.id = annotation_id and a.auteur_anonyme_id = (select auth.uid())));

-- Le rattrapage (message_retour existant → premier message « equipe ») est un import ponctuel, donc hors migration
-- (charte de portabilité, S2) : scripts/imports/20260928_v22_rattrapage_messages.sql
