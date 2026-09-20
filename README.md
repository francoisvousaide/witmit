# Annotate — widget d'annotation visuelle (V1)

Un seul script à ajouter sur n'importe quelle page web (maquette HTML, app en dev) pour poser des commentaires
visuels précis : clic sur un élément, encadré d'une zone, ou surlignage de texte. Stockage local au navigateur
(`localStorage`), aucune donnée ne quitte le poste.

## Installation (une ligne)

```html
<script src="annotate.js" data-project="monprojet" data-email="moi@exemple.fr"></script>
```

- `data-project` : nom du projet — sert de clé de stockage (partagée entre toutes les pages du projet) et de titre du rapport.
- `data-email` : facultatif, destinataire du bouton « Envoyer ».
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
- **Rapport** (📤 Télécharger / 📋 Copier / 📧 Envoyer) : un fichier Markdown `annotate-<projet>-R-AAAA-MM-JJ-n.md` — par page, chaque ticket en texte lisible puis en bloc JSON (cibles, position, fenêtre, navigateur, erreurs console…), et en fin de fichier la consigne de réponse. Périmètre par défaut **nouveautés** (tickets nouveaux + réponses aux compléments) ; case « Rapport complet » pour tout. Générer marque les tickets **signalés** après confirmation (Annuler = rapport sans marquage).
- **Retour** (📥 Coller un retour) : bloc texte, une ligne par ticket — `<id> pris_en_compte`, `<id> resolu | message`, `<id> complement | question`. Statuts tolérants (« pris en compte », « vu », « corrigé », « fait », « question »…). Historique conservé par ticket.
- Le badge 📋 compte ce qu'il reste à traiter ; « Masquer les résolus » (mémorisé).

## Développement

```bash
npm install            # une fois
npx playwright install chromium
npm test               # suite Playwright (3 pages : 2 maquettes TellUs + 1 page générique)
```

- `src/annotate.js` — le widget (CSS + interface + logique dans un seul fichier).
- `test/pages/` — pages de test. Les copies TellUs sont générées par `tools/strip-tellus-module.py` à partir des maquettes d'origine (jamais modifiées).
- `archive/` — les 3 fichiers sources d'origine (référence, plus utilisés).
- `CADRAGE-2026-09-18.md` — décisions produit (roadmap V1 → V4).
