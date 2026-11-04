# Reprendre le projet

État au 4 novembre 2026 : **« Je vote qui ? » est en ligne** sur https://jevotequi.fr (domaine chez OVH, site hébergé par Vercel ; https://jevotequi.vercel.app reste l'adresse technique), code public sur https://github.com/Fasterious/jevotequi.

## Ce qui est fait

- Chaîne de données en 6 étapes contrôlées (`pipeline/`), 28 contrôles automatiques, tests Python et JavaScript ; la chaîne a été rejouée le 3 novembre 2026 et redonne exactement les mêmes chiffres.
- Tous les scrutins publics depuis juillet 2022 (13 683 au 2 novembre 2026), mis à jour chaque nuit par GitHub Actions.
- Site (`web/`) : accueil (signature, vidéo de présentation, quiz), quiz, comparer, scrutins, députés, méthode, page « Le projet » avec formulaire d'avis. Aucune ressource chargée chez un tiers.
- Neutralité : aucun groupe mis en avant par défaut, libellés sans nom de personne, règles identiques pour tous.
- Déploiement : projet Vercel relié au dépôt (chaque envoi sur `main` met le site à jour), domaine jevotequi.fr déjà rattaché au projet.
- Avis des visiteurs : fonction `api/avis.js`, dépôt privé `Fasterious/jevotequi-avis` avec ses étiquettes, variable `AVIS_REPO` réglée dans Vercel.
- Routines : revue assistée des propositions de modification (chaque samedi, avis envoyé au mainteneur, rien n'est écrit sur GitHub) ; synthèse hebdomadaire des avis (ticket de synthèse dans le dépôt privé).
- Vidéo de présentation (1 min 10, sous-titrée) intégrée à l'accueil et à la page « Le projet ». Les vidéos sont fabriquées dans un studio séparé, hors de ce dépôt.

## Démarrer sur un ordinateur

Prérequis : Python 3.11 ou plus (avec numpy), Node 20 ou plus.

```bash
cd web
npm ci
npm run build
npx vite preview
```

Vérifier :

```bash
pip install -r pipeline/requirements.txt
python3 -I -m unittest discover -s tests
node --test tests/avis.test.cjs
```

Recalculer les données depuis les sources officielles (environ 450 Mo d'archives, puis quelques milliers d'amendements récupérés un par un et gardés en cache ; 15 minutes environ la première fois) :

```bash
python3 -I pipeline/run.py all
```

## Ce qui reste à faire

| # | Tâche | Qui |
|---|---|---|
| 1 | Créer le jeton GitHub des avis (accès fin, dépôt `jevotequi-avis` seulement, permission « Issues : Read and write ») et le renseigner dans Vercel sous `AVIS_GITHUB_TOKEN`, puis redéployer | le porteur |
| 2 | Faire relire les 37 questions du quiz par un comité pluraliste (statut « proposé » → « relu »), au minimum les trois montrées dans la vidéo (Mayotte, gel des pensions, parité dans les petites communes), avant toute diffusion large | le porteur ou un comité |

Pour reprendre le projet : lire `REPRISE.md`, `ROADMAP.md` et `METHODOLOGIE.md`.
