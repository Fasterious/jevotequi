# Journal des versions

La version de la **méthode** suit le principe suivant :
- **majeure** (2.0.0) : changement de définition qui modifie le sens d'un indicateur ;
- **mineure** (1.1.0) : nouvelle règle, nouveau rattachement, nouvelle donnée ;
- **corrective** (1.0.1) : correction d'erreur sans changement de définition.

Chaque version de la chaîne est comparée à la précédente ; toute différence dans les données publiées est expliquée ici.

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
