-- Réveil quotidien de la base witmit.
-- Sur l'offre Free, Supabase met le projet en pause après 7 jours sans activité : le widget cesserait de fonctionner.
-- Un workflow GitHub Actions (.github/workflows/keep-alive.yml) appelle cette fonction chaque jour à 6 h UTC.
-- Elle passe par la base de données elle-même (pas seulement par l'API), ne lit ni n'écrit aucune table
-- et renvoie seulement l'heure du serveur.
create or replace function public.ping()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select now();
$$;

comment on function public.ping() is 'Réveil quotidien (keep-alive) appelé par GitHub Actions — renvoie now(), ne touche aucune donnée.';

-- Par défaut, Postgres autorise tout le monde à exécuter une nouvelle fonction : on referme, puis on n'ouvre qu'au rôle anon.
revoke all on function public.ping() from public;
grant execute on function public.ping() to anon;
