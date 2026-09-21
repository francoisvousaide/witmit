# Prompt de lancement — Annotate V2 (nouvelle session Claude Code)

*À coller tel quel pour démarrer la session. Rédigé le 21/09/2026 à la fin de la session V1.*

---

Je suis François, entrepreneur solo non-développeur, j'apprends à coder via Claude Code. Quand tu emploies un terme technique (repo, commit, policy, RLS, edge function…), redéfinis-le brièvement la première fois. Une étape à la fois : je valide avant que tu passes à la suivante ; pas de gros bloc de code sans que je comprenne ce qu'il fait. Tutoiement, direct, sans flatterie.

## Contexte

Je construis **Annotate**, un widget d'annotation visuelle (une balise `<script>` à poser sur n'importe quelle page pour collecter des retours précis : clic sur un élément, encadré, texte surligné → commentaire catégorisé + bloc technique + capture d'écran). La **V1 est terminée et testée** (mode « maquette » : tout reste dans le navigateur, export par rapport). Lis d'abord, dans cet ordre :

1. `/Users/francois_/Dev/annotate-widget/BILAN-V1-2026-09-21.md` — ce qui existe, où, et ce qui manque pour un site live
2. `/Users/francois_/Dev/annotate-widget/CADRAGE-2026-09-18.md` — toutes les décisions produit (roadmap V1→V4, sécurité, pipeline, compléments du 20 et 21/09)
3. `/Users/francois_/Dev/annotate-widget/README.md` — mode d'emploi du widget tel qu'il est
4. `/Users/francois_/Documents/Claude/Z-Brain/10-Missions-AgenceIA/mes_outils/Outil_Annotate/BRIEF_Annotate.md` — la vision d'origine

Le code : `/Users/francois_/Dev/annotate-widget` (git local, branche `main`, 23 commits, pas encore sur GitHub). Le widget : `src/annotate.js`. Tests : `npm test` (114 tests Playwright, ~2 min 20, à relancer avant tout commit — ils doivent rester verts).

## Le besoin qui change tout : un site LIVE, demain

Mon app **TellUs DB** tourne en production (`/Users/francois_/Dev/TellUs-app` — Next.js 14 App Router, TypeScript, Tailwind, Supabase SSR déjà câblé, déployé sur Vercel ; lis son `CLAUDE.md`, il renvoie vers `Z-Brain/05-TellusDB/STATUT.md`). Je veux qu'Annotate y soit **utilisable dès le 22/09** par moi et quelques testeurs, sans que les visiteurs ordinaires le voient. Les maquettes HTML de TellUs n'étaient qu'un terrain d'essai : la cible, c'est les sites qui tournent.

## Mission de cette session : Annotate V2, en deux vitesses

### Vitesse 1 — utilisable demain (priorité absolue, à faire en premier)
1. **Invisible par défaut** sur un site public : boutons masqués tant qu'un raccourci secret (ou un paramètre d'URL, ex. `?annotate=on`, mémorisé en localStorage) ne les a pas révélés ; un moyen de les re-cacher. `data-mode="live"` sur la balise active ce comportement (`data-mode="mock"` = comportement V1 actuel).
2. **Intégration dans TellUs-app** : `annotate.js` servi depuis `public/`, balise dans `app/layout.tsx` (composant `next/script`, chargé après l'hydratation), `data-project="tellus"`, `data-mode="live"`, `data-email` vers moi. Respecter les règles du `CLAUDE.md` de TellUs-app (navbar unique, ne pas toucher à l'auth Supabase, validation étape par étape) et mettre à jour `STATUT.md` en fin de session comme il le demande.
3. Vérifier en preview Vercel avant la prod ; en attendant la collecte centralisée, les testeurs m'envoient leur rapport (Copier / Télécharger / Envoyer) — ça marche déjà.

### Vitesse 2 — collecte centralisée (à cadrer ensemble AVANT de coder, comme prévu au cadrage)
4. **Supabase** : table `annotations` minimale (`id, projet, page, texte, categorie, statut, donnees_techniques jsonb, date_creation, auteur optionnel anonyme`), région EU, images de capture dans Supabase Storage (pas en base). Le widget envoie chaque ticket à l'enregistrement (`data-supabase-url` / `data-supabase-key` sur la balise) tout en gardant la copie locale.
5. **Sécurité version simple** (décidée) : clé anonyme + policy « ajout seul » (jamais lecture/modification/suppression des autres) + limite de fréquence côté navigateur. **À reposer explicitement pour TellUs DB** (trafic, public) : suffit-il, ou Turnstile / validation serveur dès maintenant ?
6. **Retour** : le format « annotate-retour » de la V1 (une ligne par ticket : id, statut, message) devient la base ; en V2 le statut se lit depuis Supabase (statut visible côté utilisateur : nouveau / en cours / résolu) et, pour les projets avec repo, une **issue GitHub** par ticket (texte + JSON) — brancher plus tard le mécanisme « assigner à un agent ».
7. **Hébergement du script** : dépôt GitHub public + jsDelivr, versionné par tag (tranché au cadrage). Pousser `annotate-widget` sur GitHub (compte à confirmer avec moi), `v1.0.0`, puis remplacer la copie dans `public/` de TellUs-app par l'URL jsDelivr quand c'est stable.

### Plus tard (ne pas ouvrir sans mon accord)
- V2.5 : extension de navigateur « enveloppe » (voir CADRAGE, complément du 20/09).
- V3 : module RAG léger, bouton volontaire uniquement.
- Points ouverts : nom définitif du produit, mapping catégorie → niveau d'autonomie, passage manuel → automatique du pipeline.

## Filtres à respecter à chaque proposition
Faisable seul (aucune dépendance à un outil que je ne maîtrise pas sans qu'on en discute d'abord) ; budget < 10 k€ / < 200 €/mois ; résultat visible rapidement ; **RGPD** : données minimales (pas d'IP, pas d'email dans les tickets sauf choix explicite, pas de paramètres d'URL), Supabase en région EU, aucune IA qui scanne les données à la saisie (ligne rouge du cadrage).

## Comment démarrer
Avant tout code : (1) confirme-moi en 5 lignes ce que tu as compris de l'état actuel ; (2) propose un plan court pour la **vitesse 1** (utilisable demain), avec pour chaque étape ce qu'elle livre et comment on vérifie (tests existants + nouveaux, preview Vercel) ; (3) attends ma validation. La vitesse 2 se cadrera après, question par question, comme au cadrage initial.
