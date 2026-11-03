"""Utilitaires partagés par les étapes du pipeline (aucune règle métier ici)."""
from __future__ import annotations

import csv
import hashlib
import html
import json
import re
import sys
import time
import unicodedata
from dataclasses import dataclass
from pathlib import Path

csv.field_size_limit(sys.maxsize)
T0 = time.time()
ROOT = Path(__file__).resolve().parent.parent


def log(*args):
    print(f"[{time.time() - T0:6.1f}s]", *args, flush=True)


@dataclass(frozen=True)
class Paths:
    """Emplacements des données. Tout est relatif à la racine du projet par défaut."""

    raw: Path = ROOT / "data" / "raw"  # archives officielles et documents téléchargés
    tables: Path = ROOT / "data" / "tables"  # tables intermédiaires (CSV), reproductibles
    reports: Path = ROOT / "data" / "reports"  # contrôles, couverture, sensibilité
    site: Path = ROOT / "web" / "public" / "data"  # fichiers servis par le site

    @property
    def documents(self) -> Path:
        return self.raw / "documents"


# ---------------------------------------------------------------- texte


def as_list(x):
    if x is None:
        return []
    return x if isinstance(x, list) else [x]


def sval(x):
    """Valeur texte ou None (les champs vides sont publiés comme {"@xsi:nil": "true"})."""
    return x if isinstance(x, str) else None


def fold(s: str | None) -> str:
    """Minuscules, sans accents, apostrophes et espaces normalisés."""
    if not s:
        return ""
    s = s.replace("’", "'").replace(" ", " ").replace(" ", " ")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s.lower()).strip()


def clean_spaces(s: str | None) -> str:
    if not s:
        return ""
    s = s.replace("’", "'").replace(" ", " ").replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()


def html_to_text(h) -> str:
    if not h or not isinstance(h, str):
        return ""
    h = re.sub(r"(?i)<br\s*/?>|</p>|</li>|</h\d>", "\n", h)
    h = re.sub(r"<[^>]+>", " ", h)
    h = html.unescape(h)
    h = h.replace(" ", " ").replace(" ", " ").replace("’", "'")
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in h.split("\n")]
    return "\n".join(ln for ln in lines if ln)


def truncate(s: str, n: int) -> str:
    if len(s) <= n:
        return s
    cut = s[:n].rsplit(" ", 1)[0]
    return cut.rstrip(" ,;:.") + " …"


# ---------------------------------------------------------------- fichiers


def write_json(path: Path, obj, pretty: bool = False):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        if pretty:
            json.dump(obj, f, ensure_ascii=False, indent=1)
        else:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def read_json(path: Path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_csv(path: Path, header: list[str], rows) -> int:
    """CSV UTF-8, séparateur virgule, guillemets si nécessaire. Renvoie le nombre de lignes."""
    path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        for r in rows:
            w.writerow(["" if v is None else v for v in r])
            n += 1
    return n


def read_csv(path: Path) -> list[dict]:
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def nint(v) -> int | None:
    """Entier ou None depuis une cellule CSV."""
    return int(v) if v not in (None, "") else None
