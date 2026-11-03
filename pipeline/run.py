#!/usr/bin/env python3
"""Chef d'orchestre du pipeline « Je vote qui ? ».

    python3 -I pipeline/run.py all               # tout, de bout en bout
    python3 -I pipeline/run.py all --sample 200  # essai rapide sur 200 scrutins par législature
    python3 -I pipeline/run.py all --offline     # sans réseau (archives et documents déjà présents)

Étapes (chacune lit les sorties de la précédente, sur disque) :
  1 fetch      archives officielles → data/raw (+ manifeste avec empreintes SHA-256)
  2 extract    archives → tables CSV normalisées (data/tables)
  3 link       classement des scrutins, rattachement aux dossiers et amendements
  3b documents amendements introuvables dans les archives, récupérés un par un (réseau)
  4 compute    positions des groupes, statistiques, carte, couverture, sensibilité
  5 publish    fichiers du site (web/public/data)
  6 quiz       questions du quiz (pipeline/quiz.toml) reliées aux votes réels, contrôles de rédaction
Des contrôles automatiques s'exécutent après chaque étape ; un échec bloque la publication.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import checks as K  # noqa: E402
import s1_fetch  # noqa: E402
import s2_extract  # noqa: E402
import s3_link  # noqa: E402
import s3b_documents  # noqa: E402
import s6_quiz  # noqa: E402
import s4_compute  # noqa: E402
import s5_publish  # noqa: E402
from common import read_json, ROOT, Paths, log, read_csv  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("stage", choices=["all", "fetch", "extract", "link", "documents", "compute", "publish", "quiz"], nargs="?", default="all")
    ap.add_argument("--sample", type=int, default=0, help="ne traiter que N scrutins par législature (essai)")
    ap.add_argument("--offline", action="store_true", help="ne rien télécharger")
    ap.add_argument("--refresh", action="store_true", help="re-télécharger les archives")
    ap.add_argument("--force", action="store_true", help="publier même si un contrôle échoue")
    ap.add_argument("--raw", type=Path, default=None, help="dossier des archives (défaut : data/raw)")
    ap.add_argument("--out", type=Path, default=None, help="dossier du site (défaut : web/public/data)")
    a = ap.parse_args()

    base = Paths()
    if a.sample:  # un essai n'écrase jamais les données réelles
        s = ROOT / "data" / "essai"
        base = Paths(raw=base.raw, tables=s / "tables", reports=s / "reports", site=s / "site")
    paths = Paths(raw=a.raw or base.raw, tables=base.tables, reports=base.reports, site=a.out or base.site)
    for p in (paths.tables, paths.reports):
        p.mkdir(parents=True, exist_ok=True)

    stage = a.stage
    report: list[dict] = []
    if stage != "all" and (paths.reports / "controles.json").exists():
        report = read_json(paths.reports / "controles.json")  # étape isolée : le rapport existant est mis à jour

    def gate(new: list[dict]):
        at = {x["id"]: i for i, x in enumerate(report)}
        for x in new:
            if x["id"] in at:
                report[at[x["id"]]] = x
            else:
                report.append(x)
        for x in new:
            mark = {"ok": "✓", "alerte": "!", "echec": "✗"}[x["statut"]]
            log(f"  {mark} {x['id']} {x['titre']} : {x['valeur']}")
        K.write_report(paths, report)
        if any(x["statut"] == "echec" for x in new) and not a.force:
            log("✗ contrôle bloquant en échec : arrêt (relancer avec --force pour publier quand même)")
            sys.exit(1)

    if stage in ("all", "fetch") and not a.offline:
        log("① téléchargement")
        s1_fetch.run(paths, refresh=a.refresh)
    if stage in ("all", "extract"):
        log("② extraction")
        info = s2_extract.run(paths, sample=a.sample)
        gate(K.check_extract(paths, sample=bool(a.sample)))
    else:
        info = None
    seance_organe = (info or {}).get("seance_organe") or {16: "PO791932", 17: "PO838901"}
    if stage in ("all", "link"):
        log("③ rapprochements")
        s3_link.run(paths, seance_organe)
    if stage in ("all", "documents") and not a.offline:
        missing = read_csv(paths.tables / "amendements_manquants.csv")
        if missing:
            log("③b amendements document par document")
            got = s3b_documents.run(paths)
            if got["found"]:
                log("   intégration des documents récupérés (extraction et rapprochements relancés)")
                s2_extract.run(paths, sample=a.sample)
                s3_link.run(paths, seance_organe)
    if stage in ("all", "link", "documents"):
        gate(K.check_link(paths))
    if stage in ("all", "compute", "publish"):
        log("④ calculs")
        res = s4_compute.run(paths)
        gate(K.check_compute(paths, res))
        log("⑤ publication")
        s5_publish.run(paths, res, report)
        gate(K.check_publish(paths))
    if stage in ("all", "compute", "publish", "quiz"):
        log("⑥ quiz")
        gate(s6_quiz.run(paths))
        s5_publish.write_json(paths.site / "controles.json", report, pretty=True)
    s = K.summarize(report)
    log(f"terminé — contrôles : {s['ok']} ok, {s['alerte']} alertes, {s['echec']} échecs")


if __name__ == "__main__":
    main()
