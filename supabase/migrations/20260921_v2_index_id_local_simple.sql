-- L'index unique (projet, id_local) ne doit pas être partiel : les upserts s'appuient dessus.
-- Les lignes sans id_local (NULL) restent autorisées en nombre illimité (NULL ≠ NULL pour un index unique).
drop index if exists public.annotations_projet_id_local_idx;
create unique index annotations_projet_id_local_idx on public.annotations (projet, id_local);
