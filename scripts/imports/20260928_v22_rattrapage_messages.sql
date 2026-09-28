-- witmit V2.2 — rattrapage ponctuel (28/09/2026), après la migration 20260928_v22_messages.sql.
-- Le message_retour actuel de chaque ticket devient son premier message « equipe » dans le fil.
-- Date approximative : la dernière mise à jour du ticket (la date exacte du commentaire n'a pas été gardée).
-- Rejouable : un ticket qui a déjà un message « equipe » n'est pas touché.
insert into public.messages (annotation_id, de, texte, cree_le)
select a.id, 'equipe', left(a.message_retour, 2000), a.mis_a_jour_le
from public.annotations a
where a.message_retour is not null and btrim(a.message_retour) <> ''
  and not exists (select 1 from public.messages m where m.annotation_id = a.id and m.de = 'equipe');
