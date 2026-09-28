-- witmit V2.1 — l'auteur d'un ticket (28/09/2026)
-- auteur_nom    : le prénom de la personne qui a écrit le ticket, nettoyé par le guichet (60 caractères max).
-- auteur_source : d'où vient ce nom —
--   'hote'       le site hôte l'a déclaré (membre connecté du site, ex. TellUs-app) ;
--   'invitation' lien d'invitation nominatif (à venir) ;
--   'declare'    la personne l'a tapé elle-même, ou attribution a posteriori (à venir).
-- Les deux colonnes sont facultatives : un ticket sans auteur connu reste anonyme, comme avant.
-- Aucune règle d'accès (RLS) modifiée : seul le guichet écrit, avec la clé serveur.

alter table public.annotations
  add column auteur_nom text,
  add column auteur_source text;

alter table public.annotations
  add constraint annotations_auteur_nom_longueur check (auteur_nom is null or char_length(auteur_nom) between 1 and 60),
  add constraint annotations_auteur_source_valeurs check (auteur_source is null or auteur_source in ('hote', 'invitation', 'declare'));
