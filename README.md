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
- Si la page contient déjà des boutons `#cmToggleBtn` / `#cmPanelBtn` (maquettes TellUs), ils sont réutilisés ; sinon deux boutons flottants apparaissent en bas à droite.
- Gestes en mode annotation : clic = élément (bulle après 250 ms, le temps d'un éventuel double-clic) · double-clic = mot · triple-clic = paragraphe · glisser = encadré (ajustable tant que sa bulle est ouverte) · Maj+glisser = sélection de texte précise.
- Raccourci : `Alt+A` (Windows/Linux) · `⌥+A` (Mac) — ignoré pendant la saisie dans un champ. `Échap` annule la bulle ou quitte le mode.

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
