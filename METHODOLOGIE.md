# Méthodologie

Version de la méthode : **1.2.0** (voir `CHANGELOG.md`). Toute modification d'une règle de calcul, de classement ou de rattachement incrémente cette version, qui est publiée avec les données (`meta.json → methodVersion`).

Ce document décrit précisément comment les chiffres du site sont produits, comment ils sont vérifiés, et ce qu'ils ne disent pas. Il vise un lecteur non spécialiste mais exigeant : chaque règle est énoncée, justifiée, et rattachée au code qui l'applique.

---

## 1. Question posée

> À quelle fréquence deux groupes politiques (ou deux députés) prennent-ils la même position lors des votes de l'Assemblée nationale ?

Le site décrit des **comportements de vote observés**. Il ne qualifie pas les votes (bons ou mauvais), n'en infère pas les motivations et ne prédit rien.

## 2. Sources

Une seule source : les **données ouvertes de l'Assemblée nationale** ([data.assemblee-nationale.fr](https://data.assemblee-nationale.fr/)), sous Licence Ouverte Etalab 2.0.

| Jeu de données | Contenu utilisé |
|---|---|
| Scrutins (16e et 17e législatures) | intitulé, date, type, résultat, vote nominatif de chaque député, ventilation par groupe |
| Acteurs, mandats, organes (historique) | identité des députés, mandats et dates de prise de fonction, groupes, partis de rattachement, gouvernements |
| Dossiers législatifs | titre du texte, commission saisie au fond, séances de discussion, scrutins cités |
| Amendements | numéro, auteur et son groupe, article visé, exposé sommaire, dispositif |
| Amendements, document par document (`/dyn/opendata/<identifiant>.json`) | complément quand l'archive est illisible (§ 6.2) |

Chaque archive téléchargée est consignée dans `data/raw/manifest.json` (adresse, taille, empreinte **SHA-256**, date de publication côté serveur, date de téléchargement). Le site republie ce manifeste (`sources.json`) : n'importe qui peut vérifier qu'il travaille sur les mêmes fichiers.

## 3. Périmètre

- **Inclus** : tous les scrutins publics de l'Assemblée nationale depuis le début de la 16e législature (premier scrutin : 11 juillet 2022), y compris les motions de censure.
- **Exclus** : le scrutin du Congrès du 4 mars 2024 (il réunit députés et sénateurs) ; les votes à main levée et les votes en commission, qui ne sont pas nominatifs ; les scrutins secrets (élection du président de l'Assemblée…).
- La plupart des votes de l'Assemblée se font à main levée : ce site porte sur les **scrutins publics**, qui couvrent les votes les plus disputés et l'essentiel des votes finaux, mais pas tous les amendements.

L'exhaustivité est mesurée à chaque exécution (`couverture.json`) : nombre de scrutins par législature et par année, numéros manquants, part des scrutins rattachés à un texte, part des amendements dont le contenu a été retrouvé.

## 4. Chaîne de traitement

Le traitement est découpé en étapes indépendantes. Chacune lit les sorties de la précédente **sur disque**, dans des formats ouverts (CSV, JSON), ce qui permet d'inspecter chaque transformation.

| Étape | Code | Entrée | Sortie | Contrôles |
|---|---|---|---|---|
| ① Téléchargement | `pipeline/s1_fetch.py` | adresses officielles | `data/raw/*.zip`, `manifest.json` | intégrité des archives |
| ② Extraction | `pipeline/s2_extract.py` | archives | tables CSV (`data/tables`) | E1 à E7 |
| ③ Rapprochements | `pipeline/s3_link.py` | tables | `scrutins_enrichis.csv`, `textes.csv` | L1 à L5 |
| ③b Documents | `pipeline/s3b_documents.py` | amendements manquants | `data/raw/documents` | (réintégrés en ② et ③) |
| ④ Calculs | `pipeline/s4_compute.py` | tables | `positions.csv`, statistiques, carte, couverture, sensibilité | K1 à K4 |
| ⑤ Publication | `pipeline/s5_publish.py` | résultats | `web/public/data` | P1 |

L'extraction ne contient **aucune règle éditoriale** : elle recopie les données publiées. Les choix éditoriaux (familles politiques, thèmes, types de vote) sont regroupés dans `pipeline/config.py`.

Un mode d'essai (`--sample N`) exécute toute la chaîne sur N scrutins par législature (plus les scrutins de référence) en une dizaine de secondes, sans toucher aux données publiées.

## 5. Définitions

### 5.1 Position d'un groupe à un scrutin

Pour chaque groupe, on compte les votes **pour**, **contre** et **abstention** de ses membres (apparentés compris) à partir des listes nominatives. La position du groupe est celle qui a réuni le plus de voix.
- Égalité entre les deux premières positions : groupe **partagé**, exclu des comparaisons.
- Aucun membre n'a voté : **pas de position**.
- Les non-inscrits ne forment pas un groupe : ils n'ont pas de position collective.

Le champ `positionMajoritaire` publié par l'Assemblée **n'est pas utilisé** : il vaut « pour » par défaut quand aucun membre n'a voté, et contredit les décomptes dans 3 216 cas (contrôle K3). Exemple vérifiable : au scrutin 17/3985, les socialistes ont voté 17 contre et 4 abstentions ; le champ publié indique « abstention ».

### 5.2 Motions de censure

Seuls les votes « pour » existent. Un groupe est compté **« pour »** si plus de la moitié de ses membres a voté la motion, **« contre »** sinon : ne pas voter la censure revient à maintenir le gouvernement. La majorité requise est celle publiée pour chaque scrutin (289 voix, un peu moins quand des sièges sont vacants).

### 5.3 Familles politiques

Un groupe est propre à une législature (Renaissance en 2022, Ensemble pour la République en 2024…). Pour suivre une formation sur toute la période, chaque groupe est rattaché à une famille (`config.FAMILIES`). Un député qui change de groupe est compté, à chaque vote, dans le groupe sous lequel l'Assemblée a enregistré son vote.

### 5.4 Taux d'accord

Pour deux entités A et B (groupes ou députés), on retient les scrutins où **les deux** ont pris position (pour, contre ou abstention) :

```
taux d'accord = nombre de scrutins où A et B ont la même position / nombre de scrutins où les deux ont pris position
```

Le reste se répartit entre **votes opposés** (l'un pour, l'autre contre) et **désaccords partiels** (l'un s'abstient, pas l'autre). Le nombre de scrutins (n) est toujours affiché ou accessible : un taux calculé sur moins de 30 scrutins est signalé comme fragile.

### 5.5 Sous-ensembles

- **Votes finaux** : votes sur l'ensemble d'un texte.
- **Grands votes** : votes finaux, parties de budget, motions de censure, votes de confiance, déclarations du Gouvernement.
- **Scrutins disputés** : scrutins où au moins deux groupes ont pris des positions différentes.

## 6. Rattachements

Chaque rattachement est enregistré avec **sa méthode** (colonnes `methode_*` de `scrutins_enrichis.csv`, champ `lien` des fichiers de détail), du plus sûr au moins sûr.

### 6.1 Texte (dossier législatif)

1. référence publiée dans le scrutin ;
2. référence publiée dans le dossier (le dossier cite le scrutin) — si plusieurs dossiers citent le même scrutin, une motion de censure est rattachée à l'engagement de responsabilité, les autres au premier identifiant (règle déterministe) ;
3. dossier de l'amendement mis aux voix ;
4. séance du scrutin (si un seul dossier y a été discuté, ou si l'intitulé du texte correspond à plus de 30 % des mots) ;
5. intitulé du texte identique au titre d'un dossier.

**Contrôle croisé** (depuis la version 1.1.0) : un même intitulé de texte, dans une législature, renvoie à un même dossier.
- Un rattachement dont le dossier ne partage aucun mot significatif avec l'intitulé du scrutin, et qui contredit au moins 80 % des rattachements sûrs (méthodes 1 à 3) des scrutins du même texte (au moins 3), est **corrigé** vers ce dossier : la référence publiée par l'Assemblée est parfois erronée (4 corrections dont 2 références publiées, par exemple le scrutin 17/6758, publié comme portant sur le corps électoral de la Nouvelle-Calédonie alors qu'il porte sur la loi agricole).
- Un rattachement par la séance sans ressemblance d'intitulé et non confirmé par d'autres scrutins du même texte est **retiré** (3 cas) : aucun rattachement plutôt qu'un faux.
- Un titre de dossier peut légitimement différer de l'intitulé du texte (« Fin de vie » pour la proposition de loi sur l'aide à mourir) : c'est pourquoi la ressemblance seule ne suffit jamais à corriger.

### 6.2 Amendement mis aux voix

Plusieurs textes peuvent être examinés dans une même séance avec des numéros identiques (journée réservée à un groupe, loi et loi organique examinées ensemble) : le numéro et la séance ne suffisent pas. Règle de choix (`s3_link.pick_amendment`, testée) :

1. **séance et numéro**, puis, parmi les candidats :
   - seuls ceux du dossier de la référence publiée, s'il y en a une ;
   - si les candidats viennent de textes différents : seuls ceux dont le sort (adopté / rejeté) ne contredit pas le résultat du scrutin ;
   - si l'intitulé cite un député (« l'amendement n° 12 de Mme X ») : ceux dont il est l'auteur ou un cosignataire ;
   - puis le dossier suggéré par la séance, sinon le titre de dossier le plus proche de l'intitulé ;
   - un candidat sans aucun élément en sa faveur est écarté : **aucun amendement affiché plutôt qu'un faux** ;
2. **dossier et numéro** : seulement le même jour (à un jour près, séances de nuit) et avec un sort cohérent, car un même numéro existe à chaque lecture d'un texte ;
3. **document individuel** : l'archive de la 16e législature étant illisible côté serveur (vérifié en novembre 2026 : le serveur ne renvoie plus aucun octet au-delà des premiers mégaoctets, pour les variantes JSON et XML), l'amendement est cherché un par un. Son identifiant n'étant pas cité par le scrutin, il est reconstruit à partir des textes du dossier (texte de la commission puis texte déposé, partie du budget, numéro). Un document n'est retenu que si **sa séance de discussion est celle du scrutin** et que son sort ne contredit pas le résultat ; son dossier est déduit de son texte, ce qui permet les contrôles ci-dessous.
   *Validation* : sur 8 006 amendements de la 17e législature dont l'identifiant est connu, l'identifiant juste figure toujours parmi les candidats (67 % au premier essai). Sur un échantillon de 40 scrutins de la 16e législature, 39 amendements ont été retrouvés avant la généralisation.

*Contrôles* : l'amendement affiché appartient au texte du scrutin (L6, aucun écart toléré) ; son auteur ou un cosignataire est le député cité par l'intitulé (L8 : 99,8 % ; les écarts restants sont des intitulés qui citent le député ayant défendu l'amendement plutôt que son premier signataire, numéro, séance, texte et sort concordant).

### 6.3 Texte visé par une motion de censure (article 49.3)

1. **référence publiée** : le dossier d'engagement de responsabilité cite le scrutin ;
2. **séance de la motion** : un seul engagement de responsabilité a été débattu dans la séance du scrutin.
   *Validation* : sur les 11 motions de la 17e législature dont la référence est publiée, cette méthode donne le même résultat dans 9 cas sur 9 et s'abstient dans les 2 cas ambigus ;
3. **date (probable)** : à défaut, l'engagement le plus récent dans les 12 jours précédant le vote ; affiché « probablement », il ne crée pas de rattachement.

### 6.4 Thème

Mots-clés appliqués au titre du dossier (`config.THEME_RULES`, exceptions d'abord), sinon thème de la commission saisie au fond. Classement automatique, relu sur les 70 textes les plus votés ; il peut se tromper sur des textes hybrides. Le thème est affiché sur la page de chaque scrutin.

## 7. Indicateurs par député

- **Participation** : part des scrutins publics tenus pendant ses périodes de mandat (dates de prise de fonction, pour tenir compte des ministres qui quittent puis retrouvent leur siège) où il a voté pour, contre ou abstention, hors motions de censure.
- **Vote avec son groupe** : part de ses votes identiques à la position de son groupe au même scrutin.
- **Accord avec chaque famille** : part de ses votes identiques à la position de cette famille.

Une participation faible ne mesure pas le travail d'un député : beaucoup de scrutins ont lieu la nuit ou pendant des réunions de commission.

## 8. Carte des députés

Pour chaque paire de députés, on calcule la part des scrutins disputés où ils ont voté différemment (au moins 25 votes communs, sinon moyenne des paires de leurs familles). Un **positionnement multidimensionnel classique** place les points pour que leurs distances reproduisent au mieux ces désaccords. Seuls les députés ayant voté au moins 100 fois figurent sur la carte. Les axes n'ont pas d'unité ; la carte est seulement tournée (rotation, sans déformation) pour placer LFI à gauche, le RN à droite et Renaissance en haut. La part de la variance expliquée par les deux axes est publiée.

## 9. Validation

1. **Contrôles automatiques** à chaque exécution (`controles.json`, détaillés sur le site). Un contrôle en échec bloque la publication.
2. **Valeurs de référence** vérifiées à la main sur les pages officielles (contrôle K1, tests `tests/test_donnees_publiees.py`).
3. **Vérification par échantillon** : les décomptes par groupe de 50 scrutins tirés au hasard (tous types, deux législatures) ont été comparés aux pages officielles : 49 identiques ; dans le dernier (17/9), la page web et le fichier de données ouvertes de l'Assemblée rangent trois députés dans des groupes différents ; nous suivons le fichier.
4. **Tests automatisés** des règles (`tests/test_regles.py`), y compris sur les coquilles réellement présentes dans les intitulés officiels.
5. **Non-régression** : toute nouvelle version de la chaîne est comparée à la précédente ; chaque différence doit être expliquée (voir `CHANGELOG.md`).

## 10. Analyse de sensibilité

Les conclusions ne doivent pas dépendre d'un choix de définition arbitraire. Pour chaque paire de groupes, le taux d'accord est recalculé selon six définitions (`sensibilite.json`) :

| Définition | Ce qui change |
|---|---|
| référence | même position (pour, contre ou abstention) |
| demi-abstention | une abstention face à un pour ou un contre compte pour un demi-accord |
| sans abstention | seuls les scrutins où les deux ont voté pour ou contre |
| disputés | seuls les scrutins où les groupes ne sont pas tous d'accord |
| votes finaux | seuls les votes sur l'ensemble d'un texte |
| poids par texte | chaque texte pèse autant, quel que soit son nombre de scrutins |

Pour chaque groupe de référence, on mesure la **stabilité du classement** des autres groupes (corrélation de rang de Spearman entre la définition de référence et chaque variante). Ces résultats sont publiés sur la page « Méthode ».

## 11. Limites connues

- Tous les scrutins pèsent pareil : un amendement de détail compte autant que le vote final d'une loi (voir les filtres et l'analyse de sensibilité).
- Le taux dépend de ce qui est mis au vote : un groupe qui dépose beaucoup d'amendements rejetés par tous paraît éloigné de tous.
- Voter pareil ne veut pas dire être allié : deux oppositions peuvent rejeter un texte pour des raisons contraires.
- Les « mises au point » (un député déclare après coup avoir voulu voter autrement) ne modifient pas le résultat officiel et ne sont pas prises en compte.
- Le thème est attribué automatiquement.

## 12. Corrections apportées aux données sources

| Anomalie dans la source | Traitement |
|---|---|
| 146 groupes publiés sans identifiant (`PO0`) | groupe retrouvé par l'appartenance de ses votants à la date du vote (contrôle E6) |
| Champ `positionMajoritaire` incohérent (3 216 cas) | non utilisé ; positions recalculées |
| 4 décomptes publiés différant d'une voix de la liste nominative | la liste nominative fait foi (contrôle E4) |
| Mandats des ministres revenus à l'Assemblée datés du jour de l'élection | date de reprise de fonction (`datePriseFonction`) |
| Archive des amendements de la 16e législature illisible | récupération document par document (§ 6.2) |
| Référence de dossier publiée erronée pour quelques scrutins | correction par les autres scrutins du même texte (§ 6.1) |
| Sort d'amendement contradictoire avec le résultat du scrutin (quelques cas) | le résultat officiel du scrutin fait foi ; l'amendement reste affiché s'il est le seul du texte avec ce numéro |

## 13. Hypothèses testées et écartées

- **Retenir le premier amendement de la séance portant le numéro cité** (version 1.0.0) : écarté en 1.1.0. Quand deux textes sont examinés dans la même séance, l'amendement d'un autre texte pouvait être affiché (9 cas trouvés, dont la proposition de loi sur les ZFE du 12 janvier 2023 illustrée par un amendement sur la tenue uniforme à l'école).

- **Apparier les motions de censure aux scrutins par ordre de dépôt** (Nᵉ motion ↔ Nᵉ vote) : écarté. Des numéros manquent (21 et 28 en 16e législature), une motion de la 17e n'a pas été votée, et le contrôle par les signataires et par les références publiées donne de nombreux désaccords.
- **Rattacher une motion au dernier engagement de responsabilité par la date** : écarté comme méthode principale (erreurs constatées, par exemple les trois motions du 24 octobre 2022 rattachées à tort au budget de la sécurité sociale) ; conservé seulement en dernier recours, affiché « probable ».

## 14. Le quiz

Le quiz (« Et vous, vous auriez voté quoi ? ») fait voter la personne sur de vrais scrutins, puis compare ses réponses aux positions des groupes.

**Ce qui est calculé, ce qui est rédigé.** Les positions des groupes sont celles du reste du site (§ 5.1), calculées à partir des votes nominatifs ; aucune n'est saisie à la main (un test vérifie qu'elles sont identiques à celles publiées pour chaque scrutin). Seule la **formulation** des questions est rédigée, dans `pipeline/quiz.toml`, un fichier lisible et relu ligne à ligne.

**Choix des scrutins.** Votes publics disputés (au moins un groupe pour et un groupe contre), de préférence décisifs (ensemble d'un texte, article clé, amendement très suivi), répartis sur les 15 thèmes et les deux législatures. Sont exclus les motions de censure (on ne peut y voter que « pour », et elles portent sur un gouvernement, pas sur une mesure) et les votes de procédure.

**Règles de rédaction** (vérifiées automatiquement, contrôles Q1 à Q7) :
1. une question par scrutin, 160 caractères au plus, terminée par « ? » ;
2. la mesure votée en mots simples, sans nom de parti, de groupe ou de député, sans jugement de valeur ni chiffre absent du texte ;
3. « Pour » = pour la mesure décrite ; si le scrutin portait sur un amendement de suppression, la question décrit la mesure et le sens est inversé (`sens = "inverse"`), ce que la page explique ;
4. le contexte donne la date, le texte et ce qui change, jamais le résultat ni le vote des groupes, révélés après la réponse avec l'origine du texte.

**Le texte voté, avant de répondre.** Sous le contexte, « Lire le texte voté » ouvre un panneau qu'on referme, ou d'où l'on répond directement : le résumé, le texte voté (pour un amendement, ce qu'il propose et l'exposé de ses auteurs, extraits publiés par l'Assemblée nationale, parfois abrégés) et le lien vers la page officielle (qui indique aussi le résultat). Le site n'affiche l'auteur et le vote des groupes qu'après la réponse ; l'exposé des auteurs, qui est leur argumentaire et pas celui du site, peut les nommer.

**Déroulé** (depuis la version 1.2.0). Le quiz commence par un bloc de 10 questions. Après chaque bloc, le résultat s'affiche avec une invitation : « Ces 10 questions ont été tirées au sort : affinez votre profil avec 10 questions de plus. » On continue ainsi jusqu'à épuisement des questions des thèmes choisis (aujourd'hui 10 + 10 + 10 + 7) ; quand ces thèmes sont épuisés, le quiz propose d'ajouter les autres. La personne répond pour ou contre, ou passe la question ; l'abstention n'est pas proposée.

**Tirage** (`web/src/lib/tirage.ts`, testé par `tests/quiz.test.mjs`). Les questions d'un bloc sont tirées une à une, sans remise :
1. *thème* : d'abord ceux qui ne figurent pas encore dans le bloc (jamais deux fois le même thème dans un bloc tant que d'autres thèmes ont des questions), puis, à égalité, ceux dont la plus faible part des questions a déjà été posée : tous les thèmes sont couverts dès les deux premiers blocs et s'épuisent au même rythme ;
2. *question* : au hasard parmi celles de ces thèmes, avec une probabilité proportionnelle à son **pouvoir de départage**. Pour chaque paire de groupes, la réponse crée entre eux un écart de points selon le barème du profil (1 entre un groupe pour et un groupe contre, ½ entre un groupe abstenu et un groupe qui a voté, 0 entre deux groupes du même avis) ; le pouvoir de départage est la somme de ces écarts sur toutes les paires, rapportée au maximum possible avec le même nombre de groupes (moitié pour, moitié contre). Il vaut 1 pour un vote coupé en deux, 0,64 pour 8 groupes contre 2, 0,36 pour 9 contre 1. Il se calcule sur les positions publiées, ne dépend pas du sens de la réponse et ne favorise aucun groupe.

Le hasard demeure : chaque question figure dans le premier bloc de 12 % à 42 % des parties, et deux personnes ont en moyenne 2,8 questions communes sur leurs 10 premières. Les 37 questions actuelles étant toutes disputées (contrôle Q2), la pondération change peu de chose aujourd'hui : pouvoir de départage moyen de 0,88 pour le premier bloc contre 0,86 pour l'ensemble, et, dans les simulations ci-dessous, aucune différence mesurable avec un tirage uniforme sur la probabilité que le groupe en tête après 10 ou 20 réponses le reste à la fin. Elle comptera davantage quand l'ensemble s'élargira à des votes moins partagés. Les questions retirées ne sont jamais tirées ; les liens de résultats partagés reposent toujours sur le rang des questions dans `quiz.toml`, que le tirage ne modifie pas.

**Accord avec un groupe.** 1 point si le groupe a pris la même position, ½ point s'il s'est abstenu, 0 s'il a voté l'inverse ; un groupe partagé ou absent n'est pas compté. La marge affichée sur chaque pourcentage est un intervalle de Wilson à 90 %, qui décrit l'incertitude due au tirage des questions (environ ± 23 points pour 10 réponses, ± 17 pour 20, ± 14 pour 30). Comme le tirage favorise les votes les plus disputés, les premiers blocs ne sont pas un échantillon uniforme de l'ensemble : l'accord affiché est celui des questions répondues, et l'intervalle reste une approximation. Des groupes exactement à égalité en tête sont présentés ensemble, avec le nombre de votes comptés pour chacun.

**Solidité du classement.** Les marges des pourcentages ne disent pas si le groupe en tête l'est nettement : deux groupes qui ont voté pareil sur presque toutes les questions ont des marges qui se chevauchent largement, mais ne se départagent que sur les questions où ils diffèrent. La solidité se mesure par rééchantillonnage (bootstrap) : 1 000 fois, on tire au hasard, avec remise, autant de questions qu'il y a de réponses (pour ou contre) parmi celles données — certaines comptent deux fois, d'autres pas du tout — et on refait le classement. La solidité est la part de ces tirages où le groupe en tête sur l'ensemble des réponses reste en tête ; une égalité dans un tirage est partagée entre les ex aequo, et si plusieurs groupes sont à égalité en tête, on compte la part où l'un d'eux le reste. Le site l'affiche ainsi : « Le groupe en tête le reste dans 82 % des tirages de vos réponses » (arrondi à l'entier inférieur). La graine du tirage est dérivée des réponses (empreinte des couples question-réponse triés, questions passées exclues) : les mêmes réponses donnent toujours le même chiffre, y compris depuis un lien partagé ; avec 1 000 tirages, l'imprécision du calcul est d'au plus 1,6 point (un écart type). Ce chiffre n'est **pas** une probabilité d'appartenir à un groupe ni une consigne : il dit seulement si le résultat tient à quelques questions.

**Paliers**, présentés comme des étapes de précision et non comme des récompenses : *profil esquissé* à partir de 10 réponses (pour ou contre ; les questions passées ne comptent pas), *profil affiné* à partir de 20, *profil solide* à partir de 25 réponses si la solidité atteint 90 %. Un palier redescend si de nouvelles réponses rendent le classement moins net.
- Le seuil de 90 % reprend la convention des marges du site.
- Le minimum de 25 réponses vient d'une simulation (`node tests/quiz-simulation.mjs`, graines fixes) : 4 000 personnes fictives (qui votent comme un groupe avec 15 % ou 30 % d'écarts, entre deux groupes voisins, ou au hasard) répondent aux 37 questions tirées comme sur le site. Parmi celles dont la solidité atteint 90 %, le groupe en tête l'est encore après toutes les questions dans 54 % des cas à 10 réponses, 75 % à 15, 84 % à 20, 93 % à 25 et 97 % à 30 : avec peu de réponses, le rééchantillonnage surestime la stabilité, car il ne peut que rebattre les réponses déjà données. Le seuil ne tient sa promesse qu'à partir de 25 réponses ; avant, le résultat précise que le chiffre surestime la stabilité.
- Le palier « solide » reste rare, ce qui est attendu : à 30 réponses, il est atteint par 24 % des personnes fictives qui votent comme un groupe avec 15 % d'écarts, 13 % de celles qui hésitent entre deux groupes voisins et 1 % de celles qui répondent au hasard.

**Équilibre de l'ensemble** (contrôle Q6). Si un groupe votait « pour » à presque toutes les questions, une personne répondant souvent « pour » lui ressemblerait mécaniquement. Pour chaque groupe, la part des questions où il a voté pour la mesure doit rester entre 20 % et 80 % ; elle est publiée sur la page Méthode. Test complémentaire : une personne qui répondrait « pour » à tout obtient entre 49 % et 76 % d'accord avec chaque groupe ; aucune réponse mécanique ne désigne nettement un groupe.

**Limites.** Le quiz compare des réponses à des votes passés de groupes parlementaires : il ne dit rien des programmes, des candidats ni des raisons d'un vote (un groupe peut voter contre un texte qu'il juge insuffisant). Dix, vingt ou trente-sept questions donnent une tendance, pas un verdict ; un profil « solide » aussi. La solidité ne mesure que la stabilité du classement sur les questions posées : elle ne dit rien des questions que le quiz ne pose pas. Les simulations reposent sur des personnes fictives : elles éclairent le choix des seuils, elles ne prouvent rien sur de vraies réponses. Un groupe qui n'a pris position que sur une partie des questions a un taux plus variable, donc plus souvent extrême : l'UDR, créée en 2024, n'est comptée que sur 20 questions sur 37, et des réponses tirées au hasard la placent en tête dans 19 % des cas, contre 9 % si tous les groupes avaient les mêmes chances (même simulation). Les formulations sont proposées par le projet et doivent être relues par un comité éditorial pluraliste avant diffusion large ; chacune peut être contestée par une contribution.

**Confidentialité.** Les réponses restent dans le navigateur (aucun envoi). Un lien de partage contient les réponses codées ; c'est la personne qui choisit de le partager.

## 15. Reproduire

```bash
pip install -r pipeline/requirements.txt
python3 -I pipeline/run.py all --sample 200   # essai rapide
python3 -I pipeline/run.py all                 # chaîne complète (≈ 430 Mo d'archives, puis les amendements 2022-2024 un par un)
python3 -I -m unittest discover -s tests -v
```

Les fichiers publiés, le manifeste des sources (empreintes SHA-256) et le rapport de contrôle permettent de vérifier qu'une exécution reproduit la précédente.
