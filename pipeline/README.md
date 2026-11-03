# Chaîne de traitement des données

```bash
pip install -r pipeline/requirements.txt
python3 -I pipeline/run.py all --sample 200   # essai sur un échantillon (≈ 10 s, n'écrase rien)
python3 -I pipeline/run.py all                 # chaîne complète
python3 -I pipeline/run.py compute --offline   # relancer seulement les calculs et la publication
```

| Fichier | Rôle |
|---|---|
| `run.py` | orchestre les étapes et les contrôles ; s'arrête si un contrôle bloquant échoue |
| `config.py` | **choix éditoriaux** : familles politiques, thèmes, types de vote, version de la méthode |
| `s1_fetch.py` | ① télécharge les archives officielles, écrit le manifeste (SHA-256) |
| `s2_extract.py` | ② archives → tables CSV, sans règle éditoriale |
| `s3_link.py` | ③ type de vote, texte, amendement, thème, texte visé par une censure |
| `s3b_documents.py` | ③b amendements introuvables dans les archives, récupérés un par un |
| `s4_compute.py` | ④ positions des familles, statistiques des députés, carte, couverture, sensibilité |
| `s5_publish.py` | ⑤ fichiers du site |
| `checks.py` | contrôles automatiques et valeurs de référence |
| `families.py` | rattachement groupe → famille |
| `common.py` | utilitaires (fichiers, texte) |

La méthode est décrite dans `../METHODOLOGIE.md`, les tables et fichiers dans `../DONNEES.md`.
