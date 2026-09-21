-- witmit V2 — schéma initial (21/09/2026)
-- Principe : tout est fermé (RLS) ; le navigateur ne peut que LIRE ses propres tickets et images.
-- Seule l'Edge Function (clé service_role, qui ignore la RLS) écrit.

-- ---------- 1. Les sites autorisés ----------
create table public.projets (
  slug        text primary key,                 -- = data-project de la balise <script>
  nom         text not null,
  github_repo text,                             -- "owner/repo" pour la création d'issues (étape F)
  actif       boolean not null default true,
  cree_le     timestamptz not null default now()
);
alter table public.projets enable row level security;   -- fermé, aucune policy : serveur seulement

insert into public.projets (slug, nom, github_repo) values ('tellus', 'TellUs DB', 'TellUs-Cultures/tellus-app');

-- ---------- 2. Les tickets ----------
create table public.annotations (
  id                 uuid primary key default gen_random_uuid(),
  projet             text not null references public.projets(slug),
  page               text not null,
  texte              text not null,
  categorie          text not null default 'a_classer',
  statut             text not null default 'nouveau' check (statut in ('nouveau', 'en_cours', 'resolu')),
  donnees_techniques jsonb not null default '{}'::jsonb,
  date_creation      timestamptz not null default now(),
  auteur_anonyme_id  uuid not null,             -- auth.uid() du visiteur (auth anonyme) ; pas de clé étrangère : un ticket survit à la purge du compte anonyme
  id_local           text,                      -- identifiant du ticket dans le navigateur (lien copie locale ↔ serveur)
  capture_chemin     text,                      -- chemin de l'image dans le bucket captures (jamais l'image en base)
  message_retour     text,                      -- message à l'auteur quand le statut change
  github_issue_url   text,                      -- rempli par l'étape F
  mis_a_jour_le      timestamptz not null default now()
);
create index annotations_projet_date_idx on public.annotations (projet, date_creation desc);
create index annotations_auteur_idx on public.annotations (auteur_anonyme_id);
create unique index annotations_projet_id_local_idx on public.annotations (projet, id_local) where id_local is not null;

alter table public.annotations enable row level security;
-- Seule ouverture : un visiteur connecté (anonyme) lit les tickets dont il est l'auteur.
create policy "auteur lit ses tickets" on public.annotations
  for select to authenticated
  using (auteur_anonyme_id = (select auth.uid()));

-- ---------- 3. Compteur pour le rate-limit (étape C) ----------
create table public.quotas (
  cle           text primary key,               -- ex. "tellus" ou "tellus:<auteur>"
  compteur      integer not null default 0,
  fenetre_debut timestamptz not null default now()
);
alter table public.quotas enable row level security;    -- fermé : serveur seulement

-- Incrémente le compteur de la clé dans la fenêtre courante ; renvoie true si on est encore sous le plafond.
create or replace function public.consommer_quota(p_cle text, p_max integer, p_fenetre interval)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_compteur integer;
begin
  insert into public.quotas (cle, compteur, fenetre_debut)
  values (p_cle, 1, now())
  on conflict (cle) do update
    set compteur      = case when public.quotas.fenetre_debut + p_fenetre < now() then 1 else public.quotas.compteur + 1 end,
        fenetre_debut = case when public.quotas.fenetre_debut + p_fenetre < now() then now() else public.quotas.fenetre_debut end
  returning compteur into v_compteur;
  return v_compteur <= p_max;
end;
$$;
revoke all on function public.consommer_quota(text, integer, interval) from public, anon, authenticated;

-- ---------- 4. Le bucket des captures ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('captures', 'captures', false, 1048576, array['image/jpeg']);

-- Chemin d'une image : <auteur_anonyme_id>/<id ticket>.jpg — chacun relit son propre dossier.
create policy "auteur lit ses captures" on storage.objects
  for select to authenticated
  using (bucket_id = 'captures' and (storage.foldername(name))[1] = (select auth.uid())::text);
