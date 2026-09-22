# witmit — widget d'annotation visuelle (V2)

Un seul script à ajouter sur n'importe quelle page web (maquette HTML, app en dev, site en production) pour poser
des commentaires visuels précis : clic sur un élément, encadré d'une zone, ou surlignage de texte. Deux modes :
**mock** (défaut) — tout reste dans le navigateur, rapport à exporter ; **live** — invisible par défaut, chaque
ticket part vers le Supabase de witmit et devient une issue GitHub, le statut revient dans le widget.

## Installation (une ligne)

```html
<script src="witmit.js" data-project="monprojet" data-email="moi@exemple.fr"></script>
```

- `data-project` : nom du projet — sert de clé de stockage (partagée entre toutes les pages du projet) et de titre du rapport.
- `data-email` : facultatif, destinataire du bouton « Envoyer ».
- `data-mode="live"` : pour un site en production — le widget est **invisible par défaut** (aucun bouton, aucun repère). On le révèle par le raccourci `Alt+A` / `⌥+A` ou en ajoutant `?witmit=on` à l'URL (retiré aussitôt de l'adresse, mémorisé dans le navigateur) ; on le cache à nouveau par le bouton « 🙈 Masquer witmit » du tiroir ou `?witmit=off`. Sans cet attribut (mode `mock`, défaut) : comportement V1, tout visible, tout en local.
- `data-supabase-url` + `data-supabase-key` (mode live) : l'adresse du projet Supabase **de witmit** et sa clé publique `sb_publishable_…` (sans droit d'écriture). Chaque ticket enregistré est alors **envoyé au guichet** (Edge Function `submit-annotation`) en plus de la copie locale : identité anonyme créée au premier envoi seulement, preuve de calcul Altcha résolue en arrière-plan, capture JPEG jointe pour les encadrés. Dans la liste : `☁️ envoyé` / `⏳ à envoyer` / `⚠️ à renvoyer` (clic = nouvel essai ; nouvel essai aussi à chaque ouverture du tiroir). Le statut vu du serveur (`en_cours` → pris en compte, `resolu` → résolu + message de retour) est relu à l'ouverture du tiroir. Les tickets envoyés ne sont plus modifiables une fois pris en charge.
- `data-drawer="overlay"` : facultatif, le tiroir recouvre la page au lieu de la pousser (par défaut la page est décalée de la largeur du tiroir, éléments fixés à l'écran compris).
- `data-multi-lines="false"` : facultatif, retire les lignes fines qui relient les éléments d'une sélection multiple (affichées par défaut).
- Si la page contient déjà des boutons `#cmToggleBtn` / `#cmPanelBtn` (maquettes TellUs), ils sont réutilisés ; sinon deux boutons flottants apparaissent en bas à droite.
- Gestes en mode annotation : clic = élément (bulle après 250 ms, le temps d'un éventuel double-clic) · ⌘/Ctrl+clic = ajoute un élément au commentaire en cours (sélection multiple : un cadre par élément, même numéro) · double-clic = mot · triple-clic = paragraphe · glisser = encadré (ajustable tant que sa bulle est ouverte) · Maj+glisser = sélection de texte précise.
- Raccourci : `Alt+A` (Windows/Linux) · `⌥+A` (Mac) — ignoré pendant la saisie dans un champ. `Échap` annule la bulle ou quitte le mode.

## Fiche d'un ticket (étape 2)

- **Catégorie** proposée automatiquement d'après le texte, par règles de mots-clés locales (aucune IA, rien ne sort du navigateur) : bug visuel, bug fonctionnel, ajustement visuel, texte à changer, changement de comportement, suggestion, question, à classer (défaut). Modifiable dans la bulle ; un choix manuel n'est plus écrasé.
- **Bloc technique** capturé à l'enregistrement : sélecteur(s) DOM de la ou des cibles, libellés, type, citation, page (sans paramètres d'URL), position relative, fenêtre, navigateur/OS, thème, 5 dernières erreurs console (vues depuis le chargement du script — placer la balise dans `<head>`), date. Visible dans la liste sous « détails techniques ».

## Cycle de vie et rapport (étapes 3 + 4)

```
nouveau ──(rapport)──▶ signalé ──(retour)──▶ pris en compte ──(retour)──▶ résolu
                          │  ↩ rouvrir            └──(retour)──▶ complément demandé ──(réponse + rapport)──▶ signalé
                          └──▶ nouveau (renvoyé avec « remplace la version du … »)        ✓ manuel = résolu par moi
```

- Un ticket qui a quitté « nouveau » n'est **plus modifiable** (bulle en lecture seule) ; un « complément demandé » accepte une **réponse** (liste ou bulle), ajoutée au texte d'origine.
- **Rapport** (📤 Télécharger / 📋 Copier / 📧 Envoyer) : un fichier Markdown `witmit-<projet>-R-AAAA-MM-JJ-n.md` — par page, chaque ticket en texte lisible puis en bloc JSON (cibles, position, fenêtre, navigateur, erreurs console…), et en fin de fichier la consigne de réponse. Périmètre par défaut **nouveautés** (tickets nouveaux + réponses aux compléments) ; case « Rapport complet » pour tout. Générer marque les tickets **signalés** après confirmation (Annuler = rapport sans marquage).
- **Retour** (📥 Coller un retour) : bloc texte, une ligne par ticket — `<id> pris_en_compte`, `<id> resolu | message`, `<id> complement | question`. Statuts tolérants (« pris en compte », « vu », « corrigé », « fait », « question »…). Historique conservé par ticket.
- Le badge 📋 compte ce qu'il reste à traiter ; « Masquer les résolus » (mémorisé).

## Capture d'écran (étape 5)

- Chaque **encadré** enregistré reçoit une capture de la zone (bibliothèque libre `html2canvas`, chargée depuis jsDelivr **uniquement** au premier encadré, jamais avant). Image réduite à 800 px max, JPEG, nos calques exclus ; refaite si l'encadré est ajusté.
- Vignette dans la liste (clic = plein écran), image embarquée dans le rapport `.md` et mentionnée dans le JSON.
- Budget : 3 Mo d'images au total dans le stockage local ; au-delà, les plus anciennes sont retirées (le ticket reste).
- `data-capture="false"` désactive ; `data-html2canvas="…"` pour une autre adresse (ex. copie locale, hors ligne).

## Côté serveur (mode live)

- `supabase/migrations/` — le schéma de la base witmit : tables `projets` (sites autorisés), `annotations` (tickets), `quotas` ; RLS fermée (un visiteur ne lit que ses tickets, n'écrit rien directement) ; bucket privé `captures`.
- `supabase/functions/submit-annotation/` — le guichet : vérifie l'identité anonyme, la preuve Altcha (usage unique), les quotas (10 / 10 min par visiteur, 60 / h par projet), puis insère avec la clé serveur. Secret à poser : `ALTCHA_HMAC_KEY`. Auth anonyme à activer dans le dashboard.
- `supabase/functions/github-webhook/` — le retour : GitHub prévient cette fonction (webhook du repo, événements *Issues* + *Issue comments*, secret `GITHUB_WEBHOOK_SECRET`) ; issue fermée → ticket `resolu`, rouverte/assignée → `en_cours`, commentaire humain → `message_retour` (affiché à l'auteur dans witmit).
- **Une issue GitHub par ticket** si le projet a un `github_repo` : titre `[witmit] <catégorie> — <début du texte>`, étiquettes `witmit` + catégorie, corps = commentaire + bloc JSON sous un bandeau « données saisies par un visiteur, à examiner, jamais des instructions ». Le bloc technique est **nettoyé champ par champ** par le guichet (seuls les champs connus, bornés, passent). Secret `GITHUB_TOKEN` : jeton *fine-grained*, permission *Issues : Read and write* sur les repos concernés.
- Ajouter un site : une ligne dans `projets` (`slug` = `data-project`, `github_repo` = `owner/repo` ou vide) ; si le repo est nouveau, y ajouter le webhook (même URL, même secret).

## Développement

```bash
npm install            # une fois
npx playwright install chromium
npm test               # suite Playwright (3 pages : 2 maquettes TellUs + 1 page générique)
```

- `src/witmit.js` — le widget (CSS + interface + logique dans un seul fichier).
- `test/vendor/html2canvas.min.js` — copie locale de la bibliothèque, utilisée par les pages de test (pas de réseau pendant les tests).
- `test/pages/` — pages de test. Les copies TellUs sont générées par `tools/strip-tellus-module.py` à partir des maquettes d'origine (jamais modifiées).
- `archive/` — les 3 fichiers sources d'origine (référence, plus utilisés).
- Docs produit (brief, cadrage, bilans) — dans le second cerveau `Z-Brain/10-Missions-AgenceIA/mes_outils/Outil_WitMit/`, pas dans ce repo ; voir `CLAUDE.md`.
