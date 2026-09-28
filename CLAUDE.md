# Contexte projet — witmit

Repo de code du widget witmit (widget d'annotation visuelle, produit à part entière — pas un module d'un autre site). Pilote solo : François, ingénieur non-développeur, valide chaque étape avant exécution.

## À lire avant de commencer toute session

Les docs produit (vision, décisions, bilans) vivent dans le second cerveau (Z-Brain), pas dans ce repo :
`/Users/francois_/Documents/Claude/Z-Brain/10-Missions-AgenceIA/mes_outils/Outil_WitMit/`

Lire dans cet ordre :
1. `BILAN-V1-2026-09-21.md` — état actuel : ce qui existe, ce qui manque
2. `CADRAGE-2026-09-18.md` — décisions produit (roadmap V1 → V4, sécurité, pipeline)
3. `BRIEF_WitMit.md` — vision d'origine
4. `PROMPT_Cadrage_WitMit.md` — prompt de la session de cadrage initiale (historique)

**Ce fichier ne contient que des règles stables, jamais l'avancement** — comme pour les autres projets de François (voir le même principe dans `TellUs-app/CLAUDE.md`).

## Règles de méthode
- Tutoiement, direct, sans flatterie
- Terme technique nouveau (repo, commit, policy, RLS, edge function…) → le redéfinir brièvement la première fois
- Une étape à la fois : validation de François avant de passer à la suivante ; pas de gros bloc de code sans qu'il comprenne ce qu'il fait
- `npm test` (suite Playwright, voir README) doit rester vert avant tout commit

## Principe d'architecture (non négociable)
witmit est un produit à part entière, avec sa propre infrastructure, indépendante de tous les sites qu'il équipe :
- Son propre dépôt GitHub (script servi par jsDelivr, versionné par tag)
- Son propre projet Supabase (région EU, une seule base pour tous les projets, colonne `projet`) — **jamais branché sur le Supabase d'un site hôte**
- Vercel / fonctions serveur seulement si nécessaire (tableau de bord, issue GitHub)

## Documentation du repo
- `README.md` — mode d'emploi du widget (installation, attributs `data-*`, gestes, cycle de vie)
- `archive/` — les fichiers sources d'origine (référence historique, plus utilisés directement)

## Portabilité
Ce projet suit la charte de portabilité :
/Users/francois_/Documents/Claude/Z-Brain/03-SaaS-Strategie/CHARTE-PORTABILITE.md
Contrôle « Niveau 1 » (§5) obligatoire en fin de session. Inventaire du projet : DEMENAGEMENT.md.
