"""Étape 1 — Téléchargement des archives officielles de l'Assemblée nationale.

Entrée  : config.SOURCES (adresses publiques, Licence Ouverte Etalab 2.0).
Sortie  : data/raw/<clé>.zip et data/raw/manifest.json (adresse, taille, empreinte
          SHA-256, date de publication côté serveur, date de téléchargement).

Le manifeste permet à quiconque de vérifier qu'il travaille sur les mêmes fichiers.
"""
from __future__ import annotations

import datetime as dt
import time
import urllib.request
import zipfile
from pathlib import Path

import config as C
from common import Paths, log, read_json, sha256_file, write_json


def _download(url: str, dest: Path, chunk: int = 8 << 20) -> dict:
    """Téléchargement par morceaux (requêtes Range) : le serveur coupe parfois les longs
    transferts ; chaque morceau est réessayé indépendamment."""
    head = urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=120)
    size = int(head.headers["Content-Length"])
    last_modified = head.headers.get("Last-Modified")
    tmp = dest.with_suffix(".part")
    with open(tmp, "wb") as f:
        for start in range(0, size, chunk):
            end = min(size, start + chunk) - 1
            for attempt in range(12):
                try:
                    req = urllib.request.Request(url, headers={"Range": f"bytes={start}-{end}"})
                    data = urllib.request.urlopen(req, timeout=180).read()
                    if len(data) != end - start + 1:
                        raise IOError(f"lecture incomplète ({len(data)} octets)")
                    f.write(data)
                    break
                except Exception as e:  # noqa: BLE001
                    log(f"    morceau {start // chunk} : {e} — nouvel essai")
                    time.sleep(min(60, 2 ** attempt))
            else:
                tmp.unlink(missing_ok=True)
                raise IOError(f"téléchargement impossible : {url}")
    zipfile.ZipFile(tmp).testzip()
    tmp.replace(dest)
    return {"last_modified": last_modified}


def _probe(url: str) -> None:
    """Sonde rapide (fin de fichier) : certaines archives sont illisibles côté serveur au-delà
    des premiers mégaoctets ; inutile alors de lancer un long téléchargement."""
    head = urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=60)
    size = int(head.headers["Content-Length"])
    req = urllib.request.Request(url, headers={"Range": f"bytes={max(0, size - 65536)}-{size - 1}"})
    data = urllib.request.urlopen(req, timeout=45).read()
    if len(data) != min(size, 65536):
        raise IOError("fin de l'archive illisible sur le serveur")


def run(paths: Paths, refresh: bool = False) -> dict:
    paths.raw.mkdir(parents=True, exist_ok=True)
    man_path = paths.raw / "manifest.json"
    manifest = read_json(man_path) if man_path.exists() else {}
    for key, url in C.SOURCES.items():
        dest = paths.raw / f"{key}.zip"
        entry = manifest.get(key, {})
        if refresh or not dest.exists():
            log(f"téléchargement {key}")
            try:
                if key in C.OPTIONAL_SOURCES:
                    _probe(url)
                info = _download(url, dest)
                entry = {"url": url, "file": dest.name, **info, "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")}
            except Exception as e:  # noqa: BLE001
                if key in C.OPTIONAL_SOURCES:
                    log(f"  ⚠ source facultative indisponible : {key} ({e})")
                    manifest[key] = {"url": url, "file": None, "unavailable": str(e)}
                    continue
                raise
        if dest.exists():
            size = dest.stat().st_size
            if entry.get("size") != size or not entry.get("sha256"):
                entry.update({"url": url, "file": dest.name, "size": size, "sha256": sha256_file(dest)})
            entry.pop("unavailable", None)
            manifest[key] = entry
        elif key in C.OPTIONAL_SOURCES:
            manifest[key] = {"url": url, "file": None, "unavailable": "absente"}
    write_json(man_path, manifest, pretty=True)
    log(f"  manifeste : {len([k for k, v in manifest.items() if v.get('file')])} archives")
    return manifest
