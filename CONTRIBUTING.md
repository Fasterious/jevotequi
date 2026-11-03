# Contribuer

Merci de vouloir améliorer ce projet. Il repose sur trois principes, qui priment sur tout le reste :

1. **Neutralité** : la même méthode s'applique à tous les groupes. Le site compte les votes, il ne les commente pas.
2. **Traçabilité** : chaque chiffre doit pouvoir être retracé jusqu'au scrutin officiel.
3. **Reproductibilité** : n'importe qui doit pouvoir relancer la chaîne et obtenir les mêmes résultats.

## Avant de proposer une modification

- Pour un changement de **méthode** (définition, règle de classement, rattachement), ouvrez d'abord une discussion (« issue ») qui expose le problème, la règle proposée et ses effets attendus.
- Pour une **erreur dans les données**, indiquez le scrutin concerné et le lien vers la page officielle de l'Assemblée qui montre l'écart.

## Ce que doit contenir une proposition (pull request)

- Une modification ciblée, décrite simplement.
- Les tests passent :
  ```bash
  python3 -I -m unittest discover -s tests -v
  ```
- La chaîne passe ses contrôles, au moins en mode essai :
  ```bash
  python3 -I pipeline/run.py all --sample 200 --offline
  ```
- Le site se construit :
  ```bash
  cd web && npm ci && npm run typecheck && npm run build
  ```
- Si la méthode change : mise à jour de `METHODOLOGIE.md`, de `CHANGELOG.md` et de `METHOD_VERSION` (`pipeline/config.py`), avec une **comparaison avant/après** des données publiées qui explique chaque différence.
- Si un choix éditorial change (familles politiques, thèmes) : justification sourcée.

## Proposer ou corriger une question du quiz

Les questions sont dans `pipeline/quiz.toml`. Une proposition indique :

- le scrutin (identifiant `VTANR5L…`, avec le lien vers sa page officielle) ;
- la formulation, conforme aux règles écrites en tête du fichier (mesure décrite simplement, aucun nom de parti, « pour » = pour la mesure) ;
- pour une correction, ce qui est inexact ou orienté dans la formulation actuelle, source à l'appui.

Les contrôles Q1 à Q7 vérifient automatiquement les règles vérifiables ; la neutralité de la formulation est jugée en revue. Les questions ne sont jamais réordonnées ni supprimées (les liens de résultats partagés en dépendent) : on ajoute à la fin, on retire avec `statut = "retiré"`.

## Avis des visiteurs

Les avis envoyés depuis le site arrivent comme tickets étiquetés `avis` (voir README, « Avis des visiteurs »). Les étiquettes `module : …`, `type : …` et `remarques` sont posées automatiquement par des règles simples : les corriger à la main est normal. Un avis retenu devient une tâche comme une autre ; un avis hors sujet ou abusif se ferme.

## Revue

Les propositions sont relues par les mainteneurs, qui décident de leur intégration. Une revue assistée automatiquement pourra aider à vérifier les points ci-dessus ; elle ne remplace pas la décision humaine.

## Licence des contributions

En proposant une contribution, vous acceptez qu'elle soit publiée sous la licence du projet : AGPL-3.0-or-later pour le code, Licence Ouverte 2.0 pour les données.

## Style

- Code et commentaires en français, simples et lisibles.
- Pas de nouvelle dépendance sans justification (la chaîne de données n'utilise que la bibliothèque standard de Python et numpy).
- Les règles éditoriales vont dans `pipeline/config.py`, jamais dispersées dans le code.
