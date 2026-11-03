"""Étape 5 — Publication : fichiers JSON compacts du site + exports CSV.

Aucun calcul nouveau ici : mise en forme des résultats de l'étape 4.
"""
from __future__ import annotations

import collections
import csv
import datetime as dt
import re
import shutil

import config as C
from common import Paths, clean_spaces, fold, log, read_csv, read_json, truncate, write_json
from families import FAMILY_IDS, FAMILY_INDEX, POS_FAMS, POS_INDEX

DETAIL_CHUNK = 125
VOTE_CHUNK = 40


def short_title(s) -> str:
    """Intitulé sans le nom du texte (stocké une seule fois dans texts.json)."""
    from s3_link import split_reading

    t = s["titre"]
    if s["texte"] != "" and s["debut_texte"] != "":
        base, _ = split_reading(t)
        t = base[: int(s["debut_texte"])].rstrip(" ,")
        t = re.sub(r"\s+(du|de la|des|de l'|sur le|sur la|sur les|sur l'|au|à la|à l')\s*$", "", t)
        if len(t) < 6:
            t = s["titre"]
    t = t.rstrip(" .")
    return t[0].upper() + t[1:] if t else t


def run(paths: Paths, res: dict, checks: list[dict]) -> None:
    out = paths.site
    T = paths.tables
    S, deputies, order, V, maps, fam_of = res["S"], res["deputies"], res["order"], res["V"], res["maps"], res["fam_of"]
    log(f"publication dans {out}")
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    kinds = [k for k, _ in C.KINDS]
    themes = [t for t, _ in C.THEMES]
    texts = read_csv(T / "textes.csv")
    organes = {o["uid"]: o for o in read_csv(T / "organes.csv")}
    deps_csv = {d["uid"]: d for d in read_csv(T / "deputes.csv")}
    amdts = {a["uid"]: a for a in read_csv(T / "amendements.csv")}

    write_json(out / "texts.json", {
        "title": [t["titre"] for t in texts],
        "dossier": [t["dossier"] or None for t in texts],
        "leg": [int(t["legislature"]) for t in texts],
        "theme": [themes.index(t["theme"]) for t in texts],
        "commission": [C.COMMISSION_SHORT.get(t["commission"]) if t["commission"] else None for t in texts],
        "procedure": [t["procedure"] or None for t in texts],
        "n": [int(t["n"]) for t in texts],
        "first": [t["premier"] for t in texts],
        "last": [t["dernier"] for t in texts],
    })

    def author_code(s):
        a = amdts.get(s["amendement"]) if s["amendement"] else None
        if not a:
            return -1
        if a["type_auteur"] == "Gouvernement":
            return len(POS_FAMS)
        fam = fam_of(a["groupe_auteur"]) if a["groupe_auteur"] else None
        return POS_INDEX.get(fam, len(POS_FAMS) + 1) if a["groupe_auteur"] else len(POS_FAMS) + 1

    write_json(out / "scrutins.json", {
        "leg": [s["legislature"] for s in S],
        "num": [s["numero"] for s in S],
        "date": [s["date"] for s in S],
        "kind": [kinds.index(s["type"]) for s in S],
        "solemn": [1 if s["code_type"] in ("SPS", "MOC") else 0 for s in S],
        "adopted": [1 if s["sort"] == "adopté" else 0 for s in S],
        "theme": [themes.index(s["theme"]) for s in S],
        "text": [int(s["texte"]) if s["texte"] != "" else -1 for s in S],
        "title": [short_title(s) for s in S],
        "reading": [s["lecture"] for s in S],
        "pos": [s["pos"] for s in S],
        "tot": [[int(s["pour"]), int(s["contre"]), int(s["abstentions"])] for s in S],
        "author": [author_code(s) for s in S],
    })

    # --- détails par blocs (législature, numéro)
    chunks = collections.defaultdict(dict)
    leg_rows = collections.defaultdict(list)
    for s in S:
        leg_rows[s["legislature"]].append(s)
    for leg, rows in leg_rows.items():
        rows.sort(key=lambda s: s["numero"])
        for j, s in enumerate(rows):
            a = amdts.get(s["amendement"]) if s["amendement"] else None
            amdt = None
            if a:
                au = deps_csv.get(a["auteur"]) if a["auteur"] else None
                amdt = {
                    "uid": a["uid"], "num": a["numero_long"],
                    "auteur": f"{au['prenom']} {au['nom']}" if au else (a["type_auteur"] or None),
                    "auteurId": a["auteur"] or None,
                    "auteurFam": fam_of(a["groupe_auteur"]) if a["groupe_auteur"] else None,
                    "typeAuteur": a["type_auteur"] or None,
                    "signataires": a["signataires"], "article": a["article"],
                    "expose": truncate(a["expose"], 1200), "dispositif": truncate(a["dispositif"], 500),
                    "sort": a["sort"] or None, "source": a["source"],
                }
            famc = {f: s["famCounts"][f] for f in FAMILY_IDS if s["famCounts"][f][4] > 0}
            vote_str = V[leg][j, :].tobytes().decode("ascii") if leg in V else ""
            chunks[(leg, (s["numero"] - 1) // DETAIL_CHUNK)][s["numero"]] = {
                "title": s["titre"], "demandeur": s["demandeur"], "seance": s["seance"],
                "dossier": s["dossier"] or None, "votants": int(s["votants"]), "exprimes": int(s["exprimes"]),
                "requis": int(s["requis"]) if s["requis"] else None, "annonce": s["annonce"],
                "tot": [int(s["pour"]), int(s["contre"]), int(s["abstentions"]), int(s["non_votants"])],
                "fam": famc, "v": vote_str, "amdt": amdt,
                "lien": {"dossier": s["methode_dossier"] or None, "amendement": s["methode_amendement"] or None},
            }
    for (leg, k), d in chunks.items():
        write_json(out / "details" / f"{leg}-{k}.json", d)

    # --- votes des députés par blocs
    for leg, us in order.items():
        for k in range(0, len(us), VOTE_CHUNK):
            block = us[k:k + VOTE_CHUNK]
            write_json(out / "votes" / f"{leg}-{k // VOTE_CHUNK}.json", {
                "ids": block,
                "v": [V[leg][:, k + n].tobytes().decode("ascii") for n in range(len(block))],
            })

    # --- députés
    dep_list = []
    for d in sorted(deputies.values(), key=lambda d: (d["alpha"], fold(d["prenom"]))):
        dep_list.append({"id": d["id"], "prenom": d["prenom"], "nom": d["nom"], "civ": d["civ"], "party": d["party"],
                         "legs": {str(leg): L for leg, L in sorted(d["legs"].items())}})
    write_json(out / "deputes.json", dep_list)

    # --- motions de censure
    cens = []
    for s in S:
        if s["type"] != "censure":
            continue
        m = re.search(r"par (.+?) et (\d+) (?:membres|députés|de (?:ses|leurs) coll)", s["titre"])
        cens.append({"i": s["i"], "leg": s["legislature"], "num": s["numero"], "date": s["date"], "pour": int(s["pour"]),
                     "requis": int(s["requis"]) if s["requis"] else None, "adopted": s["sort"] == "adopté",
                     "article": s["article_censure"], "context": s["contexte_censure"] or None,
                     "contextMethod": s["methode_contexte"] or None,
                     "authors": clean_spaces(m.group(1)) if m else None,
                     "fam": {f: [s["famCounts"][f][0], s["famCounts"][f][4]] for f in FAMILY_IDS if s["famCounts"][f][4] > 0}})
    write_json(out / "censures.json", cens)

    # --- méta, sources, rapports
    manifest = read_json(paths.raw / "manifest.json") if (paths.raw / "manifest.json").exists() else {}
    govs = read_csv(T / "gouvernements.csv")
    fam_meta = []
    for f in C.FAMILIES:
        groups = []
        for g in f["groups"]:
            o = organes.get(g)
            if o:
                groups.append({"uid": g, "leg": int(o["legislature"] or 0), "abbr": o["libelle_abrege"], "label": o["libelle"],
                               "from": o["debut"], "to": o["fin"] or None, "color": o["couleur"]})
        fam_meta.append({"id": f["id"], "short": f["short"], "name": f["name"], "desc": f["desc"], "hasPosition": f["id"] in POS_INDEX, "groups": groups})
    legs_meta = []
    for leg in C.LEGISLATURES:
        rows = leg_rows[leg]
        legs_meta.append({"num": leg, "first": rows[0]["date"], "last": rows[-1]["date"], "n": len(rows), "deputies": len(order.get(leg, [])),
                          "chunk": DETAIL_CHUNK, "voteChunk": VOTE_CHUNK, "map": maps.get(leg)})
    write_json(out / "meta.json", {
        "generated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "methodVersion": C.METHOD_VERSION,
        "sources": C.SOURCES,
        "legislatures": legs_meta,
        "families": fam_meta,
        "positionFamilies": POS_FAMS,
        "authors": POS_FAMS + ["GOUV", "AUTRE"],
        "kinds": [{"id": k, "label": lab} for k, lab in C.KINDS],
        "themes": [{"id": t, "label": lab} for t, lab in C.THEMES],
        "governments": [{"id": g["uid"], "pm": g["premier_ministre"], "pmCiv": g["civ"], "from": g["debut"], "to": g["fin"] or None, "label": g["libelle"]} for g in govs],
        "counts": {"scrutins": len(S), "deputies": len(dep_list), "texts": len(texts), "amendments": sum(1 for s in S if s["amendement"])},
    }, pretty=True)
    write_json(out / "sources.json", {k: {kk: v.get(kk) for kk in ("url", "size", "sha256", "last_modified", "fetched_at", "unavailable")} for k, v in manifest.items()}, pretty=True)
    write_json(out / "couverture.json", res["coverage"], pretty=True)
    write_json(out / "sensibilite.json", res["sensitivity"])
    write_json(out / "controles.json", checks, pretty=True)

    # --- export CSV (positions des groupes par scrutin)
    exp = out / "exports"
    exp.mkdir(parents=True, exist_ok=True)
    label = {"P": "pour", "C": "contre", "A": "abstention", "=": "partagé", "-": ""}
    kl, tl = dict(C.KINDS), dict(C.THEMES)
    with open(exp / "positions-groupes.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["legislature", "numero", "date", "type", "theme", "texte", "intitule", "resultat", "pour", "contre", "abstention"]
                   + [f"position_{fid}" for fid in POS_FAMS] + ["source"])
        for s in S:
            w.writerow([s["legislature"], s["numero"], s["date"], kl[s["type"]], tl[s["theme"]],
                        texts[int(s["texte"])]["titre"] if s["texte"] != "" else "", s["titre"],
                        "adopté" if s["sort"] == "adopté" else "rejeté", s["pour"], s["contre"], s["abstentions"],
                        *[label[c] for c in s["pos"]], f"https://www.assemblee-nationale.fr/dyn/{s['legislature']}/scrutins/{s['numero']}"])
    total = sum(p.stat().st_size for p in out.rglob("*") if p.is_file())
    log(f"  {len(chunks)} blocs de détail, taille totale {total / 1e6:.1f} Mo")
