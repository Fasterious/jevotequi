# Reprendre le projet en local

État au 3 novembre 2026 : **version 1.1.0** de la méthode, site complet, données publiées incluses.

## Ce qui est fait

- Chaîne de données en 6 étapes contrôlées (`pipeline/`), 28 contrôles automatiques, 34 tests Python et 9 tests JavaScript.
- Tous les scrutins publics depuis juillet 2022 (13 683), contenu des amendements retrouvé à 99,2 % (2022-2024) et 99,7 % (depuis 2024).
- Site (`web/`) : accueil, quiz, comparer, scrutins, députés, méthode, page « Le projet » avec formulaire d'avis.
- Avis des visiteurs → tickets GitHub étiquetés, sans compte pour le visiteur (`api/avis.js`), prêt à activer.
- Documentation : `README.md`, `METHODOLOGIE.md`, `DONNEES.md`, `CONTRIBUTING.md`, `ROADMAP.md`, `CHANGELOG.md`.

## Démarrer sur ton ordinateur

Prérequis : Python 3.11 ou plus, Node 20 ou plus.

Le site fonctionne tout de suite avec les données déjà publiées (`web/public/data`) :

```bash
cd web
npm ci
npm run build
npx vite preview
```

Puis ouvrir l'adresse affichée (par défaut http://localhost:4173).

Vérifier que tout est en ordre :

```bash
pip install -r pipeline/requirements.txt
python3 -I -m unittest discover -s tests
node --test tests/avis.test.cjs
```

Recalculer les données depuis les sources officielles (environ 430 Mo d'archives, puis quelques milliers d'amendements récupérés un par un ; compter de 10 à 30 minutes la première fois) :

```bash
python3 -I pipeline/run.py all
```

Le résultat doit être identique aux données incluses : c'est la preuve que tout est reproductible.

## Ce qui reste à faire

| # | Tâche | Qui |
|---|---|---|
| 1 | Choisir le nom et l'adresse (propositions dans `ROADMAP.md` ; « Je vote qui ? » recommandé) | toi |
| 2 | Choisir la licence du code : MIT (actuelle, chacun fait ce qu'il veut) ou AGPL (les copies modifiées restent libres) | toi |
| 3 | « Les 5 ans » : quinquennat depuis juillet 2022 (actuel) ou cinq années glissantes | toi |
| 4 | Créer le dépôt GitHub et y envoyer le projet | Claude, avec ton accord sur le nom et la visibilité |
| 5 | Mettre le site en ligne sur Vercel (`vercel.json` est prêt) | Claude, avec ton compte |
| 6 | Activer les avis → GitHub : dépôt des avis (privé recommandé), jeton limité aux tickets, réglages Vercel, étiquettes (`README.md`, « Avis des visiteurs ») | toi pour le jeton, Claude pour le reste |
| 7 | Relire les 37 questions du quiz (`pipeline/quiz.toml`, statut « proposé » → « relu ») | toi ou un comité pluraliste |
| 8 | Vidéos de présentation : bonnes pratiques OpenScribe à fournir | toi, puis Claude |
| 9 | Routines Claude : revue des propositions de modification, synthèse hebdomadaire des avis | Claude, une fois le dépôt créé |

## Continuer avec Claude

- **Dans la même conversation** : partager le dossier du projet avec la session (application Claude : Réglages → Claude Code → Remote Control, ou `claude remote-control` lancé dans le dossier). Claude reprend alors directement sur ton ordinateur, avec tout le contexte.
- **Dans une nouvelle session** sur ton ordinateur : ouvrir Claude Code dans ce dossier et lui demander de lire `REPRISE.md`, `ROADMAP.md` et `METHODOLOGIE.md` avant de continuer.
