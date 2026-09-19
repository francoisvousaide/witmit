# Brief de lancement — outil d'annotation universel ("Annotate")

*Créé le 2026-09-04, à partir des échanges sur le projet TellusDB. Nom de code provisoire : **Annotate** — à renommer si besoin.*

## En une phrase

Un widget d'annotation visuelle qu'on ajoute à n'importe quel projet web (maquette HTML, SaaS en dev, site live, app en beta) via une seule ligne de script, activable/désactivable à volonté, pour collecter du feedback visuel précis (clic sur un objet → commentaire rattaché) — pour soi-même ou pour des clients d'agence.

## Contexte / origine

Né dans le projet TellusDB : un outil de commentaire a été construit et affiné sur les 7 maquettes HTML de TellUs Cultures (5 itérations testées via Playwright — 73 vérifications automatisées passées à la dernière version). Constat en cours de route : l'outil est devenu assez solide et générique (pas de logique propre à une seule page) pour justifier d'en faire un produit à part, réutilisable sur tous les projets — pas seulement les maquettes TellUs.

## Vision produit

- Positionnement : dans l'esprit de Marker.io / Usersnap / BugHerd (outils payants de feedback visuel sur site), mais self-hosted, gratuit ou quasi, taillé pour un usage solo + petite agence.
- Deux niveaux d'usage prévus, avec le même outil :
  1. **Mode maquette** (solo, hors-ligne, `localStorage`) — c'est ce qui existe déjà et fonctionne. À repackager en script autonome réutilisable sur n'importe quelle maquette, sans recopier du code à la main à chaque fois.
  2. **Mode site live partagé** (backend Supabase) — pour recueillir du feedback de plusieurs personnes (François + clients) sur une app en beta ou en prod, centralisé au même endroit, consultable indépendamment du navigateur/appareil de chacun.
- Usage double dans le cycle de vie d'un projet : en phase maquette avant dev, puis en phase live/beta une fois le code en place — sans changer d'outil entre les deux.

## Décisions prises le 2026-09-04

- **Portée V1** : mode maquette solo d'abord. On repackage le code déjà validé (voir plus bas) en un script autonome, sans toucher au mode partagé pour l'instant.
- **Portée V2** : mode Supabase partagé — à concevoir ensemble (pas improvisé seul), puis testé en conditions réelles sur **MesDons** (choisi comme premier terrain de test parce que c'est le projet SaaS le plus avancé).
- **Hébergement du script final** : PAS ENCORE TRANCHÉ. Deux pistes identifiées :
  - Repo GitHub public + jsDelivr (gratuit, versionné automatiquement par tag, zéro infra à gérer)
  - Supabase Storage (reste dans l'écosystème déjà en place, un peu moins pratique pour le versioning)
  - À décider ensemble au lancement de la V1.

## Ce qui existe déjà et est validé (base technique)

Construit et testé sur les maquettes TellusDB (Playwright, clics/drags/redimensionnements réels — pas de simulation JS directe) :

- Détection de zone générique par sélecteurs de motif de classe (`[class*="card"]`, etc.) — fonctionne sur n'importe quelle page sans liste de classes propre à un écran.
- Granularité de clic : cible l'élément précis (bouton, lien, icône, input, label, texte) plutôt que systématiquement le bloc englobant ; vide d'une carte → la carte elle-même.
- Ancrage résistant au redimensionnement : chemin DOM stable (`nth-of-type`) + position en fraction (0..1) de l'élément ciblé, recalculée à chaque redimensionnement — pas de coordonnées pixel brutes qui cassent.
- Fonctionne sur les pages à étapes/onglets en une seule page HTML (formulaires multi-étapes) : les repères se masquent/réaffichent selon la visibilité réelle de leur objet, via un `MutationObserver` générique (pas de code spécifique à une page).
- Cadre "vignette" animé (halo qui respire) confirmant visuellement que la page est "gelée" en mode annotation — visible en clair et en sombre.
- Enregistrement site-large : plusieurs pages/fichiers ouverts dans le même navigateur alimentent un rapport unique regroupé par page, numéroté en continu (#1, #2, #3… sur tout le site, pas remis à zéro à chaque page).
- Édition/suppression d'un commentaire existant en cliquant sa pastille (popup pré-rempli, bouton supprimer).
- Raccourci clavier adapté à la plateforme (Windows/Linux vs Mac), Entrée pour enregistrer / Maj+Entrée pour une nouvelle ligne.
- Pastille d'état déplaçable (glisser-déposer) pour ne jamais gêner la lecture.
- Deux niveaux de purge : "Effacer (page)" (commentaires de la page ouverte uniquement) et "Vider tout (site)" (tout le stockage partagé, avec confirmation) — ajouté le 04/09/2026 après un cas réel où d'anciens commentaires de test posés sous d'anciens noms de fichiers restaient coincés indéfiniment dans le rapport (voir "Journal des changements" plus bas).

**Fichiers sources actuels** (livrés à part avec ce brief — voir `annotate-core-css.txt`, `annotate-core-html.txt`, `annotate-core-js.txt`, mis à jour le 04/09/2026) : c'est le code exact validé sur TellusDB, encore sous forme de 3 blocs à injecter manuellement dans une page. La première tâche de la V1 sera de les fusionner en un seul fichier `.js` autonome qui s'injecte lui-même (style + DOM) au chargement, plutôt que de rester 3 blocs à copier-coller.

## Journal des changements

- **04/09/2026** — Rapport site-wide : numérotation continue (au lieu de repartir à #1 par page) + bouton "Vider tout (site)" pour purger le stockage partagé en un clic. Déclencheur : en pratique, une page est identifiée par son **nom de fichier exact** (`location.pathname`) ; toute page enregistrée/dupliquée sous plusieurs noms au fil des itérations crée autant d'entrées "page" séparées et permanentes dans le stockage, qui ne se nettoient jamais toutes seules — d'où un rapport pollué de vieux commentaires de test. À garder en tête pour la conception V1/V2 (voir section suivante, "Identification du projet") : l'identité d'une "page" mériterait une clé plus stable que le nom de fichier brut (ex. un identifiant explicite plutôt que déduit de l'URL), sans quoi le même problème réapparaîtra sur chaque nouveau projet où l'outil est déployé.

## Ce qu'il reste à concevoir pour le mode V2 (Supabase partagé)

Rien n'est tranché ici — c'est la matière de la prochaine session de travail sur ce projet :

- **Schéma de la table Supabase** (`annotations` ou nom similaire) : quels champs (page, zone, texte, ancre, auteur du commentaire, projet, date, statut résolu/non-résolu ?).
- **Identification du projet** : comment un même outil déployé sur MesDons, FleetOS, un site client, etc. sait à quel "projet" rattacher ses commentaires sans les mélanger — probablement un `data-project="mesdons"` sur la balise `<script>`.
- **Sécurité / RLS** : clé anonyme Supabase + policy d'écriture — comment éviter qu'un visiteur lambda d'un site en prod puisse spammer la table si le script est présent partout.
- **Contrôle d'accès** : qui peut activer/utiliser l'outil sur un site live (soi-même, un client précis) — dépend de l'auth déjà en place sur chaque projet, donc probablement à traiter projet par projet plutôt que de chercher une solution générique tout de suite.
- **Activation/désactivation à la demande** : sur un site live où le script est présent en permanence, comment le rendre invisible par défaut (raccourci clavier + paramètre d'URL secret stocké en `localStorage`, pour ne pas l'exposer aux visiteurs/clients finaux par accident).
- **RGPD / données minimales** : quelles données sont réellement nécessaires (éviter de stocker plus que le strict nécessaire — page, zone, texte, date ; pas d'email sauf si vraiment utile) ; Supabase en région EU si ce n'est pas déjà le cas.
- **Nom définitif du produit** — "Annotate" est un nom de code, pas une proposition finale.

## Prochaines étapes (quand on reprend ce projet)

1. Fusionner les 3 fichiers sources actuels en un seul script autonome (V1, mode `localStorage` uniquement), testé sur au moins 2 projets différents (pas seulement TellusDB) pour confirmer qu'il est vraiment générique.
2. Décider de l'hébergement du script (GitHub+jsDelivr vs Supabase Storage).
3. Concevoir ensemble le schéma Supabase et le mécanisme d'activation/désactivation pour le mode V2.
4. Tester le mode V2 sur MesDons en conditions réelles.
5. Revenir sur TellusDB : une fois l'outil détaché en produit à part, remplacer l'injection manuelle dans les 7 maquettes TellusDB par un simple appel au script externe (cohérence, plus facile à maintenir).

## Filtres de décision à appliquer quand on y revient

Comme pour tout projet : faisable seul ou avec un freelance ponctuel (pas de recrutement) ; budget soutenable (< 10k€, < 200€/mois en outils récurrents) ; rentabilité ou utilité concrète visible rapidement ; conforme au droit français (RGPD notamment, cf. section ci-dessus) ; compatible avec la mobilité Paris/Dordogne/Madrid. Ce projet a un avantage : contrairement à un nouveau SaaS, il n'a pas besoin d'être rentable seul — sa valeur est dans le temps gagné sur tous les autres projets (maquettes ET betas clients), donc le calcul ROI est différent et probablement déjà positif rien qu'en usage interne.
