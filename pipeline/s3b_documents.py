"""Étape 3b (réseau, facultative) — Compléter les amendements introuvables dans les archives.

L'archive des amendements de la 16e législature est illisible côté serveur (novembre 2026).
Chaque amendement reste publié individuellement :
    https://www.assemblee-nationale.fr/dyn/opendata/<identifiant>.json
L'identifiant n'étant pas cité par le scrutin, on essaie les candidats calculés à l'étape 3
(texte du dossier × partie × numéro) et on ne retient un document que si sa séance de
discussion est celle du scrutin et si son sort ne contredit pas le résultat du scrutin. Méthode validée hors ligne sur la 17e législature, puis sur
un échantillon de 40 scrutins de la 16e (39 retrouvés) avant d'être généralisée.

Cache : data/raw/documents/amendements/<identifiant>.json (null = document inexistant),
journal : data/raw/documents/manifest.json. Relancer ne retélécharge rien.
"""
from __future__ import annotations

import datetime as dt
import json
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from common import Paths, log, read_csv, read_json, write_json
from s3_link import outcome_consistent

URL = "https://www.assemblee-nationale.fr/dyn/opendata/{uid}.json"


def run(paths: Paths, workers: int = 6, limit: int = 0) -> dict:
    folder = paths.documents / "amendements"
    folder.mkdir(parents=True, exist_ok=True)
    man_path = paths.documents / "manifest.json"
    manifest = read_json(man_path) if man_path.exists() else {}
    # documents déjà en cache mais absents du journal (ex. récupérés lors de la validation)
    for path in folder.glob("AMANR5L*.json"):
        if path.stem not in manifest:
            exists = path.read_text(encoding="utf-8").strip() != "null"
            manifest[path.stem] = {"status": 200 if exists else 404,
                                   "fetched_at": dt.datetime.fromtimestamp(path.stat().st_mtime, dt.timezone.utc).isoformat(timespec="seconds")}
    todo = read_csv(paths.tables / "amendements_manquants.csv")
    if limit:
        todo = todo[:limit]
    log(f"documents : {len(todo)} scrutins d'amendement à compléter")

    def get(uid: str):
        path = folder / f"{uid}.json"
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        for attempt in range(4):
            try:
                with urllib.request.urlopen(URL.format(uid=uid), timeout=30) as r:
                    data = json.loads(r.read())
                path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
                manifest[uid] = {"status": 200, "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")}
                return data
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    path.write_text("null", encoding="utf-8")
                    manifest[uid] = {"status": 404, "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")}
                    return None
                time.sleep(2 + 3 * attempt)
            except Exception:  # noqa: BLE001
                time.sleep(2 + 3 * attempt)
        return None

    def solve(row):
        for uid in filter(None, row["candidats"].split("|")):
            a = get(uid)
            if a and a.get("seanceDiscussionRef") == row["seance"] and \
                    outcome_consistent({"sort": (a.get("cycleDeVie") or {}).get("sort")}, row.get("sort", "")):
                return uid
        return None

    with ThreadPoolExecutor(workers) as ex:
        found = list(ex.map(solve, todo))
    write_json(man_path, manifest, pretty=True)
    n = sum(1 for f in found if f)
    log(f"  {n}/{len(todo)} amendements retrouvés document par document")
    return {"found": n, "total": len(todo)}
