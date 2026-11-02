-- witmit 0.4.0 — statut « retire » (02/11/2026)
-- Un auteur retire son retour tant qu'il est encore « nouveau » (décision d1 du 29/10) : submit-annotation (route
-- …/retirer) le passe à « retire » et ferme son issue « not planned » ; github-webhook ignore ensuite ce ticket.
-- Migration additive : la contrainte accepte une valeur de plus, rien n'est effacé ni modifié.
-- Retour arrière (seulement si aucun ticket n'est « retire ») :
--   alter table public.annotations drop constraint annotations_statut_check;
--   alter table public.annotations add constraint annotations_statut_check check (statut in ('nouveau', 'en_cours', 'resolu', 'repondu'));
alter table public.annotations drop constraint annotations_statut_check;
alter table public.annotations add constraint annotations_statut_check
  check (statut in ('nouveau', 'en_cours', 'resolu', 'repondu', 'retire'));
