"""Règle éditoriale : rattachement d'un groupe politique (propre à une législature)
à une famille politique (stable d'une législature à l'autre). Voir config.FAMILIES."""
from __future__ import annotations

import re

import config as C
from common import fold, log

FAMILY_IDS = [f["id"] for f in C.FAMILIES]
FAMILY_INDEX = {fid: i for i, fid in enumerate(FAMILY_IDS)}
POS_FAMS = C.POSITION_FAMILIES
POS_INDEX = {fid: i for i, fid in enumerate(POS_FAMS)}


class FamilyMapper:
    def __init__(self, organes: dict[str, dict]):
        """organes : uid → ligne de organes.csv (libelle, libelle_abrege…)."""
        self.organes = organes
        self.cache: dict[str, str | None] = {}
        self.by_pattern: list[tuple[str, str]] = []  # (groupe, famille) rattachés par motif, à signaler

    def __call__(self, uid: str | None) -> str | None:
        if not uid:
            return None
        if uid in self.cache:
            return self.cache[uid]
        fam = next((f["id"] for f in C.FAMILIES if uid in f["groups"]), None)
        if fam is None:
            o = self.organes.get(uid) or {}
            for label in (fold(o.get("libelle")), fold(o.get("libelle_abrege"))):
                fam = next((f["id"] for f in C.FAMILIES if label and re.search(f["match"], label)), None)
                if fam:
                    self.by_pattern.append((uid, fam))
                    log(f"  ⚠ groupe {uid} ({o.get('libelle')}) rattaché par motif à {fam}")
                    break
        self.cache[uid] = fam
        return fam
