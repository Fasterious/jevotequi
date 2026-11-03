# Dictionnaire des données

Toutes les données sont en UTF-8. Les identifiants sont ceux de l'Assemblée nationale (`PA…` député, `PO…` organe, `VTANR5L17V519` scrutin, `DLR5L17N…` dossier, `AMANR5L…` amendement).

## Tables intermédiaires (`data/tables`, CSV)

Régénérées à chaque exécution ; elles permettent d'auditer chaque étape.

| Table | Une ligne par | Colonnes principales |
|---|---|---|
| `scrutins.csv` | scrutin | `uid, legislature, numero, date, code_type` (SPO ordinaire, SPS solennel, MOC censure), `sort, titre, seance, demandeur, dossier_objet, votants, exprimes, requis, annonce, pour, contre, abstentions, non_votants` |
| `votes.csv` | vote nominatif | `scrutin, depute, vote` (P pour, C contre, A abstention, N non-votant), `groupe, delegation` |
| `groupes_scrutins.csv` | groupe × scrutin | `groupe_publie, groupe` (corrigé), `methode_groupe`, décomptes publiés (`*_publie`) et recalculés depuis les listes nominatives, `position_majoritaire_publiee` (non utilisée) |
| `deputes.csv` | député | `uid, civ, prenom, nom, alpha` |
| `mandats.csv` | mandat de député | `depute, legislature, debut` (prise de fonction), `debut_publie, fin, departement, num_departement, circo, cause_mandat, cause_fin` |
| `appartenances.csv` | appartenance à un groupe | `depute, groupe, debut, fin, qualite` |
| `partis.csv` | rattachement à un parti | `depute, parti, debut, fin` |
| `organes.csv` | organe | `uid, code_type, libelle, libelle_abrege, legislature, debut, fin, couleur` |
| `gouvernements.csv` | gouvernement | `uid, premier_ministre, civ, debut, fin, libelle` |
| `dossiers.csv` | dossier législatif | `uid, legislature, titre, procedure, commission, debut, fin` |
| `dossiers_seances.csv` | séance × dossier | `dossier, seance` |
| `dossiers_votes.csv` | scrutin cité par un dossier | `dossier, scrutin` |
| `dossiers_textes.csv` | texte cité par un dossier | `dossier, date, acte, champ, texte, numero` |
| `amendements.csv` | amendement mis aux voix | `uid, numero, numero_long, seance, dossier, texte, type_auteur, auteur, groupe_auteur, signataires, article, sort, date_sort, expose, dispositif, source` (archive ou document) |
| `scrutins_enrichis.csv` | scrutin | `type, texte_nom, lecture, dossier, methode_dossier, texte, theme, amendement, methode_amendement, article_censure, contexte_censure, methode_contexte` |
| `textes.csv` | texte | `id, titre, dossier, legislature, commission, procedure, theme, n, premier, dernier` |
| `amendements_manquants.csv` | scrutin d'amendement sans contenu | `scrutin, numero, dossier, candidats` (identifiants essayés, dans l'ordre) |
| `positions.csv` | famille × scrutin | `pour, contre, abstentions, non_votants, membres, position` |

## Fichiers publiés (`web/public/data`, JSON)

| Fichier | Contenu |
|---|---|
| `meta.json` | date de génération, `methodVersion`, sources, législatures, familles et leurs groupes, gouvernements, types de vote, thèmes, effectifs |
| `scrutins.json` | colonnes alignées, une valeur par scrutin, dans l'ordre chronologique : `leg, num, date, kind` (indice dans `meta.kinds`), `solemn, adopted, theme, text` (indice dans `texts.json`, −1 sans texte), `title` (intitulé sans le nom du texte), `reading, pos` (une lettre par famille de `meta.positionFamilies` : P, C, A, = partagé, − pas de vote), `tot` (pour, contre, abstention), `author` (famille de l'auteur de l'amendement, indice dans `meta.authors`, −1 sinon) |
| `texts.json` | colonnes : `title, dossier, leg, theme, commission, procedure, n, first, last` |
| `details/<leg>-<k>.json` | scrutins n° 125k+1 à 125(k+1) : intitulé complet, demandeur, résultat officiel, décomptes par famille `[pour, contre, abstention, non-votants, membres]`, `v` (vote de chaque député, dans l'ordre de `deputes.json` pour cette législature), amendement (auteur, exposé sommaire, dispositif, source), `lien` (méthodes de rattachement) |
| `votes/<leg>-<k>.json` | `ids` (40 députés) et `v` (pour chacun, une lettre par scrutin de la législature, dans l'ordre des numéros ; « . » = absent) |
| `deputes.json` | par député et par législature : rang `i`, famille, historique de groupe, circonscription, périodes de mandat `per`, scrutins possibles `elig`, votes, répartition, motions de censure votées, vote avec son groupe `loyal [identiques, comparables]`, accord avec chaque famille `agree`, position sur la carte `xy` |
| `censures.json` | motions de censure : voix, majorité requise, article (49.2 ou 49.3), texte visé et méthode de rattachement, auteurs, voix par famille |
| `couverture.json` | exhaustivité par législature et par année |
| `sensibilite.json` | taux d'accord de chaque paire de familles selon six définitions, effectifs, stabilité des classements |
| `controles.json` | résultat de chaque contrôle automatique |
| `sources.json` | manifeste des archives : adresse, taille, empreinte SHA-256, dates |
| `exports/positions-groupes.csv` | une ligne par scrutin, position de chaque famille, lien vers la page officielle |
