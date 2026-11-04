# Feuille de route

Les demandes du porteur du projet et les idées retenues, classées par moment de traitement.

## Fait — version 1.0.0

- Tous les scrutins publics depuis juillet 2022 (16e et 17e législatures), vote nominatif de chaque député.
- Taux d'accord entre groupes et entre députés, par thème, par type de vote, dans le temps ; carte des députés ; motions de censure ; grands votes.
- Traçabilité complète : chaque chiffre → liste des scrutins → page officielle.
- Chaîne de traitement découpée en étapes contrôlables, tables intermédiaires ouvertes, contrôles automatiques bloquants, tests, manifeste des sources.
- Méthode documentée (`METHODOLOGIE.md`), analyse de sensibilité, couverture des données, hypothèses écartées.
- Licences libres (code sous licence MIT à l'origine, AGPL-3.0 depuis la mise en ligne ; données sous Licence Ouverte 2.0), guide de contribution, fichier de citation.

## Fait — version 1.1.0

- **Quiz « Et vous, vous auriez voté quoi ? »** (demandé en cours de route, traité tout de suite) : 37 vrais scrutins sur les 15 thèmes, 20 tirés au hasard, révélation du vote de chaque groupe, profil qui s'affine avec sa marge d'incertitude, +10 questions, partage des résultats, carte à faire glisser sur téléphone, boutons et clavier sur ordinateur.
- **Rattachements vérifiés de manière croisée** : 9 erreurs d'amendement ou de dossier trouvées en préparant le quiz, corrigées par des règles générales, avec trois nouveaux contrôles (L6 à L8).
- **Charte apartisane** et principes des **vidéos de présentation** dans le README.
- **Page « Le projet » et appel aux avis** (demandé en cours de route) : mission, modules actuels et à venir, engagement « en complément, jamais en remplacement », formulaire « Aidez-nous à améliorer cet outil » (modules souhaités, message libre, profil facultatif), bandeau sur chaque page.

## Fait — mise en ligne (3 novembre 2026)

- **Nom définitif : « Je vote qui ? »**, code sous **AGPL-3.0** (une copie modifiée mise en ligne doit publier son code), période conservée : depuis juillet 2022.
- **Dépôt public** sur GitHub et **site en ligne** sur https://jevotequi.fr (hébergé par Vercel), mis à jour à chaque envoi et chaque nuit ; documents récupérés un par un gardés en cache dans la mise à jour nocturne.
- **Avis des visiteurs** : dépôt privé `jevotequi-avis`, étiquettes créées, variable `AVIS_REPO` réglée ; reste le jeton (voir REPRISE.md).
- **Routines** : revue assistée des propositions chaque samedi (avis rédigé, aucune action sur GitHub, le mainteneur décide) ; synthèse hebdomadaire des avis dans le dépôt privé.
- **Neutralité renforcée** : groupe de référence et comparaisons par défaut tirés au hasard (plus de « Renaissance par défaut ») ; libellés des familles sans nom de personne ; vouvoiement partout ; règle de position d'un groupe énoncée exactement dans le quiz.
- **Aucune ressource tierce** : polices, React et D3 intégrés à la page ; plus d'appel à Google Fonts ni à un CDN.
- **Accueil réécrit** autour de la signature « Les promesses, c'est bien. Les actes, c'est mieux. », engagements visibles, vidéo de présentation (1 min 10, sous-titrée, chargée seulement au clic) ; aperçu des liens partagés.

## Prochaines étapes

- **Relecture des 37 questions du quiz** par un comité éditorial pluraliste (statut « proposé » → « relu »), avant toute diffusion large, puis élargissement à 60–80 questions pour varier les tirages.
- **Adresse jevotequi.fr** : domaine chez OVH depuis le 4 novembre 2026, zone DNS pointée vers Vercel (www redirige vers jevotequi.fr).
- **Réception des avis** : créer le jeton GitHub et le renseigner dans Vercel.
- **Quiz par blocs de 10** avec indicateur de solidité du classement (en cours, méthode 1.2.0).
- **Formats courts** pour les réseaux : teaser vertical sans voix, un vote et ses onze groupes par semaine pendant la campagne.

## Plus tard

- **Programmes 2027 et votes passés** : confronter les engagements des candidats à leurs votes, thème par thème. Méthode à définir avant tout développement (sources des programmes, règles d'appariement, relecture).
- **Quiz, suite** : pondérer les thèmes qui comptent le plus pour soi ; comparer aussi à son député (par code postal) ; images de partage des résultats.
- **Qui soutient les amendements de qui** : matrice auteur × votant (les auteurs sont déjà dans les données).
- **Citation** : identifiant pérenne (DOI) pour chaque version des données.
- **Période** : remonter avant juillet 2022 (fin de la 15e législature) si l'on veut cinq années glissantes plutôt que le quinquennat.
- Images de partage par comparaison ; recherche de son député par code postal ; « mises au point » des députés affichées en complément.
