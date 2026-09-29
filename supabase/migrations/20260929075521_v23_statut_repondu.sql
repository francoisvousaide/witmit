-- witmit V2.3 — statut « repondu » (29/09/2026)
-- Une issue fermée comme « non prévue » (state_reason = not_planned, ou duplicate) n'est pas « résolue » :
-- l'équipe a répondu. Le widget l'affiche « ✅ Répondu » ; l'auteur peut la rouvrir comme un ticket résolu.
-- Retour arrière (seulement si aucun ticket n'est « repondu ») :
--   alter table public.annotations drop constraint annotations_statut_check;
--   alter table public.annotations add constraint annotations_statut_check check (statut in ('nouveau', 'en_cours', 'resolu'));
alter table public.annotations drop constraint annotations_statut_check;
alter table public.annotations add constraint annotations_statut_check
  check (statut in ('nouveau', 'en_cours', 'resolu', 'repondu'));
