# Je vote qui ?

> **Les promesses, c'est bien. Les actes, c'est mieux.**

**Qui a voté quoi à l'Assemblée nationale, pour décider en connaissance de cause.** Ce site compare les positions des groupes politiques sur l'ensemble des scrutins publics depuis juillet 2022 (16e et 17e législatures) : qui vote comme qui, sur quels sujets, et comment cela évolue. Chaque chiffre renvoie à la liste des scrutins qui le composent, puis à la page officielle de chaque scrutin. Il ne dit pas pour qui voter : il donne à chacun les faits pour décider seul.

Logiciel libre (code sous licence AGPL-3.0, données sous Licence Ouverte 2.0). Site statique : aucune base de données, aucun pistage (ni mesure d'audience, ni publicité, ni ressource chargée chez un tiers), une seule fonction serveur pour transmettre les avis envoyés volontairement. Une chaîne de traitement en Python transforme les données ouvertes de l'Assemblée en fichiers JSON ; une application React les affiche.

## Ce que montre le site

| Page | Contenu |
|---|---|
| Quiz | « Et vous, vous auriez voté quoi ? » : de vrais scrutins par blocs de 10, tirés au sort (un thème différent par question, les votes les plus disputés plus souvent) ; après chaque réponse, le vote réel de chaque groupe et le lien vers le scrutin officiel ; après chaque bloc, un profil avec sa marge d'incertitude, la solidité du classement (rééchantillonnage des réponses) et son palier (esquissé, affiné, solide) ; carte à faire glisser sur téléphone, boutons et clavier sur ordinateur |
| Accueil | La signature, les engagements, la vidéo de présentation et l'accès au quiz ; puis le taux d'accord de chaque groupe avec un groupe de référence (tiré au hasard à l'arrivée, aucun groupe n'est mis en avant), matrice de toutes les paires, évolution par trimestre, accord par thème, carte des députés selon leurs votes, grands votes (scrutins solennels), motions de censure |
| Comparer | Deux groupes, deux députés, ou un député et un groupe : taux d'accord, par thème, par type de vote, dans le temps, et la liste de chaque vote (identiques / opposés) |
| Scrutins | Recherche dans les 13 683 scrutins, filtres (type, thème, résultat, positions : « RN pour et Renaissance contre ») |
| Scrutin | Résultat officiel, contenu de l'amendement (exposé sommaire, auteur, dispositif), hémicycle, vote de chaque groupe et de chaque député, liens officiels, méthode de rattachement |
| Députés | Recherche par nom ou département, participation, fidélité au groupe, votes contre son groupe, députés les plus proches |
| Groupe | Profil d'une famille politique, unité du groupe, membres |
| Méthode | Définitions, exhaustivité, analyse de sensibilité, contrôles automatiques, archives sources avec empreintes |
| Le projet | Pourquoi ce site, les modules actuels et à venir (programmes, promesses, comparatifs : en complément, jamais en remplacement), le formulaire « Aidez-nous à améliorer cet outil », nos engagements ; un bandeau sur chaque page y mène |

## Charte : un outil apartisan

Le but est que chacun sache **qui a voté quoi**, et se fasse son propre avis.

- **Même règle pour tous les groupes**, écrite à l'avance et publiée ; aucune exception au cas par cas.
- **Les faits, pas les commentaires** : le site compte des votes ; il ne qualifie ni un vote ni un parti.
- **Tout est vérifiable** : chaque chiffre mène au scrutin officiel de l'Assemblée nationale.
- **Aucune consigne de vote** : le quiz compare des réponses à des votes passés ; il ne dit pas pour qui voter.
- **Rien n'est collecté sans votre geste** : pas de compte, pas de pistage, aucune ressource chargée chez un tiers ; les réponses au quiz restent dans le navigateur ; seul l'avis envoyé volontairement par le formulaire « Aidez-nous » est conservé, sans nom ni adresse.
- **Les erreurs se corrigent en public** : chaque correction est datée et expliquée dans `CHANGELOG.md`.

## Vidéo de présentation

Une vidéo de 1 min 10 présente le projet (`web/public/video/`, sous-titres WebVTT). Elle ne se télécharge que si le visiteur la lance. Elle est fabriquée dans un studio séparé, avec les mêmes exigences que le site :

- **chaque question, vote et décompte montré à l'écran est vérifié par le code** contre les données publiées ; le rendu est refusé sinon ;
- **aucun groupe n'est nommé à la voix** : l'écran montre tous les groupes, dans l'ordre de l'hémicycle, avec leurs décomptes et ceux des non-inscrits ; les couleurs (et un signe dans chaque pastille) disent le vote, jamais le parti ;
- **des exemples équilibrés, choisis par calcul** parmi les questions du quiz : trois vrais votes (squat, gel des pensions, parité dans les petites communes) où chaque groupe est au moins une fois du côté du pour et une fois du côté du contre ; chaque révélation part de cercles vides, pour qu'aucune image ne mêle deux votes ;
- **le concept en une phrase**, dite une seule fois : *Les promesses, c'est bien. Les actes, c'est mieux.* ; et la limite, dite aussi : une tendance, pas un verdict ; personne ne vous dit pour qui voter ;
- **la voix est une voix de synthèse**, et la vidéo le dit.

## Avis des visiteurs : directement dans GitHub, sans compte

Le formulaire « Aidez-nous à améliorer cet outil » crée un ticket GitHub (« issue ») étiqueté, sans que le visiteur ait besoin d'un compte GitHub : la fonction serveur `api/avis.js` (Vercel) le crée avec le jeton du projet, conservé dans les réglages du serveur et jamais dans la page.

- **Rangement automatique** : une étiquette `module : …` par module coché ; `type : erreur de données`, `type : problème d'affichage` ou `type : idée` d'après les mots du message ; `remarques` quand aucune règle ne s'applique. Les règles sont dans `api/_lib/avis.js` et les étiquettes se corrigent à la main sur GitHub.
- **Protections** : champ piège et délai minimal contre les robots, 5 envois par adresse et par 10 minutes, message limité à 2 000 caractères, mentions (`@nom`, `#12`) neutralisées. Aucun nom, aucune adresse, aucune adresse IP n'est transmis.
- **Tests** : `node --test tests/avis.test.cjs` (GitHub simulé, aucun appel réseau).

Activation, une fois le dépôt et le projet Vercel créés :

1. Choisir le dépôt qui reçoit les avis : un dépôt privé dédié (recommandé au lancement : on trie avant de rendre public) ou le dépôt public du projet. **Fait : `Fasterious/jevotequi-avis`, privé.**
2. Créer un jeton GitHub à accès fin (« fine-grained ») limité à ce dépôt, avec la seule permission « Issues : Read and write ».
3. Dans les réglages du projet Vercel, ajouter `AVIS_GITHUB_TOKEN` (le jeton), `AVIS_REPO` (`proprietaire/depot`) et, si le dépôt est public, `AVIS_PUBLIC=1` (la page affiche alors le lien du ticket). **`AVIS_REPO` est réglé ; reste le jeton.**
4. Créer les étiquettes, une fois (**fait** pour `jevotequi-avis`) :
   ```bash
   AVIS_GITHUB_TOKEN=… AVIS_REPO=proprietaire/depot node scripts/avis-etiquettes.cjs
   ```
5. Redéployer. Tant que ce n'est pas fait, le formulaire propose de copier l'avis.

## Reproduire les chiffres

Prérequis : Python 3.11+ et Node 20+.

```bash
pip install -r pipeline/requirements.txt
```

Essai rapide sur un échantillon (quelques secondes, écrit dans `data/essai/`, n'écrase rien) :

```bash
python3 -I pipeline/run.py all --sample 200
```

Chaîne complète (environ 430 Mo d'archives officielles ; les amendements de 2022-2024 sont ensuite récupérés un par un, quelques milliers de requêtes mises en cache) :

```bash
python3 -I pipeline/run.py all
```

Tests (règles de classement et valeurs de référence vérifiées sur le site de l'Assemblée) :

```bash
python3 -m unittest discover -s tests
```

Site :

```bash
cd web && npm ci && npm run build && npx vite preview
```

## Une chaîne contrôlable à chaque étape

Chaque étape lit les fichiers de la précédente et écrit les siens : on peut s'arrêter, ouvrir le fichier et vérifier.

| Étape | Produit | Contrôles |
|---|---|---|
| ① Téléchargement | `data/raw/*.zip`, `manifest.json` (adresse, taille, SHA-256, date) | archive lisible |
| ② Extraction | `data/tables/*.csv` (scrutins, votes, députés, mandats, groupes, dossiers, amendements), sans aucune règle éditoriale | E1–E7 : numérotation continue, pas de double vote, décomptes nominatifs = décomptes publiés… |
| ③ Rapprochement | type de vote, texte, amendement, thème ; **la méthode de chaque rattachement est enregistrée** | L1–L8 : taux de rattachement, amendement du même texte que le scrutin, auteur cité = auteur de l'amendement… |
| ④ Calcul | positions des groupes, statistiques des députés, carte, couverture, sensibilité | K1–K4 : valeurs de référence relevées à la main sur le site de l'Assemblée |
| ⑤ Publication | `web/public/data/` (fichiers du site, export CSV) | P1 : taille des fichiers |
| ⑥ Quiz | `quiz.json` : questions de `pipeline/quiz.toml` reliées aux votes réels | Q1–Q7 : scrutin existant, vote disputé, formulation sans nom de parti, sens explicite, thèmes couverts, équilibre |

Un contrôle bloquant en échec arrête la chaîne. Le rapport complet est dans [`data/reports/controles.md`](data/reports/controles.md) et sur la page « Méthode » du site.

## Documentation

| Fichier | Contenu |
|---|---|
| [METHODOLOGIE.md](METHODOLOGIE.md) | Question posée, définitions, validations, analyse de sensibilité, limites, hypothèses écartées |
| [DONNEES.md](DONNEES.md) | Dictionnaire des tables et des fichiers publiés |
| [pipeline/README.md](pipeline/README.md) | Rôle de chaque fichier de la chaîne |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Signaler une erreur, proposer une amélioration, ce qu'une proposition doit contenir |
| [ROADMAP.md](ROADMAP.md) | Fait, prochaines étapes, plus tard |
| [CHANGELOG.md](CHANGELOG.md) | Versions de la méthode et changements de résultats |
| [CITATION.cff](CITATION.cff) | Citer le projet |
| [REPRISE.md](REPRISE.md) | Reprendre le projet en local : démarrage, état, ce qui reste à faire |

## Méthode en bref

- **Position d'un groupe** à un scrutin : le choix (pour, contre, abstention) du plus grand nombre de ses membres ayant voté ; égalité = « partagé », exclu des comparaisons. Recalculée à partir des votes nominatifs (le champ `positionMajoritaire` publié n'est pas fiable).
- **Taux d'accord** entre A et B : part des scrutins où les deux ont pris position et où ces positions sont identiques. Moins de 30 scrutins : signalé comme fragile.
- **Motions de censure** : seuls les votes « pour » existent ; un groupe est « pour » si plus de la moitié de ses membres l'a votée.
- **Thèmes** : mots-clés du titre du dossier législatif, sinon commission saisie au fond.
- **Carte** : positionnement multidimensionnel classique sur le taux de désaccord entre députés.
- **Sensibilité** : le taux d'accord est recalculé selon six définitions ; le classement des groupes par proximité avec Renaissance reste stable (corrélation de rang ≥ 0,97).
- **Quiz** : 1 point si un groupe a voté comme la personne, ½ s'il s'est abstenu ; marge d'incertitude de Wilson à 90 % ; blocs de 10 questions et solidité du classement par rééchantillonnage ; formulations contrôlées automatiquement (Q1 à Q7), en attente de relecture par un comité pluraliste (METHODOLOGIE § 14).

## Déployer

Le site est un dossier statique (`web/dist`) : Vercel, Netlify, GitHub Pages ou n'importe quel hébergeur. Pour Vercel, `vercel.json` indique la commande de build et le dossier à publier :

```bash
npx vercel deploy --prod
```

Le projet Vercel `jevotequi` est relié au dépôt GitHub : chaque envoi sur `main` met le site à jour. `.github/workflows/ci.yml` vérifie chaque proposition (tests, typage, build) et `update-data.yml` recalcule les données chaque nuit (les documents récupérés un par un sont gardés en cache).

## Licences

- Code : [AGPL-3.0-or-later](LICENSE). Chacun peut l'utiliser, le modifier et le redistribuer ; une version modifiée mise en ligne doit publier son code, pour que tout le monde puisse vérifier ce qu'elle calcule.
- Données publiées par le site : [Licence Ouverte 2.0](LICENCE-DONNEES.md), comme les données sources de l'Assemblée nationale ([data.assemblee-nationale.fr](https://data.assemblee-nationale.fr/)).

Projet indépendant de l'Assemblée nationale et de tout parti.
