# Journal des versions

La version de la **méthode** suit le principe suivant :
- **majeure** (2.0.0) : changement de définition qui modifie le sens d'un indicateur ;
- **mineure** (1.1.0) : nouvelle règle, nouveau rattachement, nouvelle donnée ;
- **corrective** (1.0.1) : correction d'erreur sans changement de définition.

Chaque version de la chaîne est comparée à la précédente ; toute différence dans les données publiées est expliquée ici.

## 1.2.0 — 3 novembre 2026

Nouvelle règle du quiz : blocs de 10 questions, tirage pondéré, solidité du classement (METHODOLOGIE § 14). Mise en ligne du site sous le nom « Je vote qui ? ». Aucun chiffre publié ne change.

- **Déroulé** : le quiz commence par 10 questions (au lieu de 20) ; après chaque bloc, le résultat s'affiche avec une invitation à l'affiner par 10 questions de plus, jusqu'à épuisement des questions.
- **Tirage** : un thème différent à chaque question d'un bloc tant que possible (les thèmes les moins couverts d'abord), et une probabilité proportionnelle au pouvoir de départage de la question (écart de points que la réponse crée entre les paires de groupes). Le hasard demeure et toutes les questions finissent par être posées. Remplace le tirage de la version 1.1.0 (20 questions au hasard, chaque thème une fois d'abord).
- **Solidité du classement** : part de 1 000 rééchantillonnages des réponses (bootstrap) où le groupe en tête reste en tête, avec une graine dérivée des réponses (même chiffre à chaque affichage et depuis un lien partagé). Remplace la mention « au coude-à-coude », fondée sur le chevauchement des marges de Wilson, qui ignorait que les groupes sont comparés sur les mêmes questions. Les marges de Wilson restent affichées sur chaque pourcentage.
- **Paliers** : profil esquissé (10 réponses), affiné (20), solide (25 réponses et 90 % des tirages) ; le minimum de 25 réponses est justifié par simulation (`node tests/quiz-simulation.mjs`).
- **Égalités en tête** : des groupes exactement à égalité sont nommés ensemble, avec le nombre de votes de chacun ; auparavant, un seul était nommé, départagé par le nombre de votes puis par l'ordre alphabétique.
- **Site** : contexte de chaque question plus lisible ; lien direct vers le scrutin officiel après chaque réponse ; « Dites pour ou contre » au lieu de « Votez comme un député » (l'abstention n'est pas proposée) ; vouvoiement dans tout le quiz.
- **Tests** : `tests/quiz.test.mjs` (tirage, stratification, pondération, solidité, paliers), lancé par l'intégration continue.
- **Libellés des familles** : aucun groupe n'est plus désigné par le nom d'une personne (« UDR (Ciotti) » devient « Union des droites pour la République » ; les descriptions de Renaissance et d'Horizons ne citent plus leur fondateur, celle de l'UDR ne la qualifie plus). Aucun chiffre ne change.
- **Chaîne rejouée le 3 novembre 2026** : les données publiées sont identiques (13 683 scrutins, 11 385 amendements, mêmes positions). Seul diffère un compteur de diagnostic du contrôle L6 (corrections intermédiaires : 4 au lieu de 6), qui dépend des documents récupérés un par un ; un premier passage, interrompu par une archive officielle corrompue au téléchargement, avait aussi manqué un amendement, retrouvé au passage suivant. La mise à jour nocturne garde désormais ces documents en cache.
- **Site, sans effet sur les données** : nom « Je vote qui ? », code sous AGPL-3.0 ; groupe de référence et comparaisons par défaut tirés au hasard (plus de groupe mis en avant) ; vouvoiement partout ; règle de position d'un groupe énoncée exactement sur la page de résultats ; polices, React et D3 intégrés à la page (plus aucun appel à Google Fonts ni à un CDN) ; accueil réécrit, vidéo de présentation chargée seulement au clic, aperçu des liens partagés, mentions légales (page « Le projet »).
- **Texte voté** : sous le contexte de chaque question du quiz, « Lire le texte voté » ouvre un panneau qu'on referme (ou d'où l'on répond) : le texte voté, ce que propose l'amendement et l'exposé de ses auteurs, et le lien vers la page officielle ; le site n'y nomme pas l'auteur (§ 14).
- **Vidéo de présentation** : refaite. Elle montre trois vrais votes choisis pour l'équilibre : sur l'ensemble de la vidéo, chaque groupe est au moins une fois du côté du pour et une fois du côté du contre, et la ligne de partage passe à trois endroits différents. Aucun groupe n'est nommé à la voix ; chiffres vérifiés automatiquement contre les données publiées ; voix de synthèse signalée à l'écran.

**Comparaison avec la version 1.1.0 :**
- données publiées (votes, positions, questions du quiz) : **identiques** ; `methodVersion` passe à 1.2.0 et les libellés des familles changent (ci-dessus) ;
- barème du profil (1, ½, 0) et marges de Wilson : **inchangés** : les mêmes réponses donnent les mêmes pourcentages ;
- liens de résultats partagés : **inchangés** (même codage, même rang des questions) ; ils affichent en plus la solidité et le palier ;
- parties en cours enregistrées dans le navigateur : reprises telles quelles (une partie commencée à 20 questions se termine à 20, puis continue par blocs de 10).

## 1.1.0 — 3 novembre 2026

Rattachements des amendements et des textes vérifiés de manière croisée.

- **Erreur trouvée** en relisant les votes choisis pour le quiz : le scrutin 16/827 (suppression des ZFE, 12 janvier 2023) affichait un amendement sur la tenue uniforme à l'école. Deux propositions de loi étaient examinées dans la même séance, chacune avec un amendement n° 1 ; la version 1.0.0 retenait le premier trouvé.
- **Nouvelle règle de choix de l'amendement** (METHODOLOGIE § 6.2) : dossier publié, sort cohérent avec le résultat, auteur cité par l'intitulé, dossier de la séance ; aucun amendement plutôt qu'un faux. Le dossier des amendements récupérés un par un est déduit de leur texte.
- **Contrôle croisé des dossiers** (§ 6.1) : 4 rattachements corrigés (2 références publiées erronées, 2 rattachements par la séance), 3 rattachements par la séance retirés.
- **Nouveaux contrôles** : L6 (amendement et scrutin sur le même texte), L7 (rattachements par la séance confirmés), L8 (auteur de l'amendement = député cité).
- **Tests** : 6 tests de règles et 4 tests sur des cas réels corrigés.
- **Thèmes** : quatre textes mal classés relevés en préparant le quiz sont corrigés par des règles explicites (`config.THEME_OVERRIDES`) : l'accord de sécurité avec l'Ukraine (classé « sécurité », désormais « défense et international »), la loi anti-squat (« sécurité » → « logement »), les lois sur le mode de scrutin municipal et l'autonomie de la Corse (« logement et territoires » → « institutions »), les accompagnants d'élèves handicapés (« social » → « éducation »).
- **Quiz** : nouvelle étape 6 (`s6_quiz.py`), 37 questions sur de vrais scrutins, contrôles Q1 à Q7 (METHODOLOGIE § 14).
- **Site** : page « Le projet » (modules actuels et à venir, engagements) et formulaire d'avis, sans effet sur les données. Sur le site public, chaque avis devient un ticket GitHub étiqueté, sans compte pour le visiteur (`api/avis.js`, à activer au déploiement).

**Comparaison avec la version 1.0.0 :**
- votes nominatifs, positions de groupe, statistiques des députés, motions de censure : **identiques** ;
- contenu d'amendement : 100 scrutins nouvellement illustrés (amendements discutés dans la séance voisine du vote, même jour et même sort), 21 remplacés par le bon amendement, 16 retirés faute de preuve ; couverture 99,2 % (2022-2024) et 99,7 % (2024-2026), contre 96,1 % et 99,9 % ;
- textes : 39 scrutins changent de texte (corrections ci-dessus, et textes renommés en cours de navette désormais rattachés à leur dossier) ;
- thèmes : 101 scrutins changent de thème (45 sur la loi anti-squat, 45 sur la réforme du mode de scrutin municipal, les autres par les corrections de rattachement).

## 1.0.0 — 3 novembre 2026

Première version publique de la méthode.

- Chaîne découpée en étapes auditables (téléchargement, extraction, rapprochements, calculs, publication), tables intermédiaires en CSV, manifeste des sources avec empreintes SHA-256.
- Contrôles automatiques à chaque étape ; un échec bloque la publication.
- Tests automatisés des règles et des valeurs de référence.
- Couverture des données et analyse de sensibilité publiées.
- Amendements de la 16e législature récupérés document par document (l'archive officielle est illisible).

**Comparaison avec la version de démonstration (0.1) :**
- votes nominatifs, positions de groupe, statistiques des députés : **identiques** ;
- **11 motions de censure** rattachées au texte visé de manière exacte (référence publiée ou séance du débat) ; la version 0.1 en rattachait 11 au mauvais texte par une heuristique de date (par exemple les trois motions du 24 octobre 2022, qui portaient sur la première partie du budget 2023 et non sur le budget de la sécurité sociale) ;
- 25 motions de 2022-2024 désormais reliées à leur dossier d'engagement de responsabilité, d'où de nouveaux « textes » dans `texts.json`.
