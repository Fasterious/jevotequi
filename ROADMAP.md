# Feuille de route

Les demandes du porteur du projet et les idées retenues, classées par moment de traitement.

## Fait — version 1.0.0

- Tous les scrutins publics depuis juillet 2022 (16e et 17e législatures), vote nominatif de chaque député.
- Taux d'accord entre groupes et entre députés, par thème, par type de vote, dans le temps ; carte des députés ; motions de censure ; grands votes.
- Traçabilité complète : chaque chiffre → liste des scrutins → page officielle.
- Chaîne de traitement découpée en étapes contrôlables, tables intermédiaires ouvertes, contrôles automatiques bloquants, tests, manifeste des sources.
- Méthode documentée (`METHODOLOGIE.md`), analyse de sensibilité, couverture des données, hypothèses écartées.
- Licences libres (code MIT, données Licence Ouverte 2.0), guide de contribution, fichier de citation.

## Fait — version 1.1.0

- **Quiz « Et toi, tu aurais voté quoi ? »** (demandé en cours de route, traité tout de suite) : 37 vrais scrutins sur les 15 thèmes, 20 tirés au hasard, révélation du vote de chaque groupe, profil qui s'affine avec sa marge d'incertitude, +10 questions, partage des résultats, carte à faire glisser sur téléphone, boutons et clavier sur ordinateur.
- **Rattachements vérifiés de manière croisée** : 9 erreurs d'amendement ou de dossier trouvées en préparant le quiz, corrigées par des règles générales, avec trois nouveaux contrôles (L6 à L8).
- **Charte apartisane** et principes des **vidéos de présentation** dans le README.
- **Page « Le projet » et appel aux avis** (demandé en cours de route) : mission, modules actuels et à venir, engagement « en complément, jamais en remplacement », formulaire « Aidez-nous à améliorer cet outil » (modules souhaités, message libre, profil facultatif), bandeau sur chaque page.

## Prochaines étapes

- **Relecture des 37 questions du quiz** par un comité éditorial pluraliste (statut « proposé » → « relu »), puis élargissement à 60–80 questions pour varier les tirages.
- **Vidéos de présentation** : appliquer les bonnes pratiques des vidéos OpenScribe (à fournir) — storytelling, animations synchronisées avec la voix et le discours, présentation du concept « Les promesses, c'est bien. Les actes, c'est mieux. ».
- **Nom et adresse définitifs** : décision commune (propositions : Je vote qui, Avant l'isoloir, Paroles et votes, Les votes parlent, Qui vote avec qui ; disponibilité des domaines vérifiée le 3 novembre 2026).
- **Dépôt public** (GitHub) et **déploiement** (Vercel), mise à jour automatique chaque nuit.
- **Activer la réception des avis dans GitHub** (code prêt et testé : `api/avis.js`) : choisir le dépôt des avis (privé recommandé au lancement), créer le jeton, le renseigner dans Vercel, créer les étiquettes (README, « Avis des visiteurs »). Les visiteurs n'ont pas de compte GitHub à créer. Dans l'aperçu claude.ai, seuls le propriétaire et les contributeurs invités enregistrent un avis ; les autres peuvent le copier.
- **Intégration continue** : tests et contrôles lancés sur chaque proposition (`.github/workflows/ci.yml`).
- **Revue assistée des contributions** : une routine qui évalue chaque proposition (respect de la méthode, tests, comparaison avant/après) et rédige un avis ; le mainteneur garde la décision.

## Plus tard

- **Programmes 2027 et votes passés** : confronter les engagements des candidats à leurs votes, thème par thème. Méthode à définir avant tout développement (sources des programmes, règles d'appariement, relecture).
- **Quiz, suite** : pondérer les thèmes qui comptent le plus pour soi ; comparer aussi à son député (par code postal) ; images de partage des résultats.
- **Synthèse régulière des avis** : une routine qui lit les nouveaux tickets « avis », corrige les étiquettes, repère les doublons et résume les demandes les plus fréquentes ; le mainteneur décide.
- **Qui soutient les amendements de qui** : matrice auteur × votant (les auteurs sont déjà dans les données).
- **Citation** : identifiant pérenne (DOI) pour chaque version des données.
- **Période** : remonter avant juillet 2022 (fin de la 15e législature) si l'on veut cinq années glissantes plutôt que le quinquennat.
- Images de partage par comparaison ; recherche de son député par code postal ; « mises au point » des députés affichées en complément.
