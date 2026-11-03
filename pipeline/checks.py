"""Contrôles automatiques, étape par étape.

Chaque contrôle renvoie un statut :
  ok      — conforme ;
  alerte  — écart connu et documenté, n'empêche pas la publication ;
  echec   — bloquant : le pipeline s'arrête avant de publier (sauf --force).

Les valeurs de référence ont été vérifiées à la main sur les pages officielles des scrutins.
"""
from __future__ import annotations

import collections
import csv

from common import Paths, fold, read_csv, read_json, write_json

# Valeurs vérifiées sur assemblee-nationale.fr (scrutin → champ → valeur attendue).
REFERENCE = [
    ("VTANR5L17V519", "pour", 331, "Censure du gouvernement Barnier, 4 décembre 2024 : 331 voix"),
    ("VTANR5L17V519", "requis", 288, "Majorité requise ce jour-là : 288"),
    ("VTANR5L17V519", "sort", "adopté", "La motion a été adoptée"),
    ("VTANR5L16V1240", "pour", 278, "Motion LIOT sur la réforme des retraites, 20 mars 2023 : 278 voix"),
    ("VTANR5L16V1240", "requis", 287, "Majorité requise : 287 (9 voix manquantes)"),
    ("VTANR5L16V1240", "sort", "rejeté", "La motion a été rejetée"),
]
REFERENCE_GROUPS = [
    ("VTANR5L17V3985", "PO845419", (0, 17, 4), "Scrutin 17/3985, socialistes : 17 contre, 4 abstentions (le champ « position majoritaire » publié dit « abstention »)"),
    ("VTANR5L17V489", "PO845401", (0, 61, 0), "Scrutin 17/489, RN publié sans identifiant de groupe : 61 contre une fois le groupe retrouvé"),
]


def _c(cid, etape, titre, statut, valeur, attendu="", detail=""):
    return {"id": cid, "etape": etape, "titre": titre, "statut": statut, "valeur": valeur, "attendu": attendu, "detail": detail}


def check_extract(paths: Paths, sample: bool = False) -> list[dict]:
    T = paths.tables
    out = []
    S = read_csv(T / "scrutins.csv")
    by_leg = collections.defaultdict(list)
    for s in S:
        by_leg[s["legislature"]].append(int(s["numero"]))
    gaps = {leg: sorted(set(range(1, max(n) + 1)) - set(n)) for leg, n in by_leg.items()}
    ng = sum(len(g) for g in gaps.values())
    if sample:
        out.append(_c("E1", "extraction", "Numérotation des scrutins continue (aucun scrutin manquant)", "ok", "—", 0, "non applicable en mode essai"))
    else:
        out.append(_c("E1", "extraction", "Numérotation des scrutins continue (aucun scrutin manquant)", "ok" if ng == 0 else "alerte", ng, 0,
                      "; ".join(f"{leg}e : {g[:10]}" for leg, g in gaps.items() if g)))
    seen, dup = set(), 0
    unknown = 0
    deps = {d["uid"] for d in read_csv(T / "deputes.csv")}
    totals = collections.defaultdict(lambda: [0, 0, 0])
    with open(T / "votes.csv", encoding="utf-8", newline="") as f:
        rd = csv.reader(f)
        next(rd)
        n_votes = 0
        for scrutin, depute, vote, _g, _d in rd:
            n_votes += 1
            k = (scrutin, depute)
            if k in seen:
                dup += 1
            seen.add(k)
            if depute not in deps:
                unknown += 1
            if vote in "PCA":
                totals[scrutin]["PCA".index(vote)] += 1
    out.append(_c("E2", "extraction", "Aucun député compté deux fois dans un même scrutin", "ok" if dup == 0 else "echec", dup, 0, f"{n_votes} votes nominatifs"))
    out.append(_c("E3", "extraction", "Tous les votants sont des députés connus", "ok" if unknown == 0 else "echec", unknown, 0))
    G = read_csv(T / "groupes_scrutins.csv")
    mism = [g for g in G if (g["pour"], g["contre"], g["abstentions"]) != (g["pour_publie"], g["contre_publie"], g["abstentions_publie"])]
    out.append(_c("E4", "extraction", "Décompte nominatif = décompte publié, groupe par groupe",
                  "ok" if not mism else "alerte" if len(mism) <= 20 else "echec", len(mism), "≤ 20 écarts connus",
                  "; ".join(f"{g['scrutin']} {g['groupe']}" for g in mism[:8]) + (" (la liste nominative fait foi)" if mism else "")))
    bad_tot = [s["uid"] for s in S if totals[s["uid"]] != [int(s["pour"]), int(s["contre"]), int(s["abstentions"])] and s["code_type"] != "MOC"]
    out.append(_c("E5", "extraction", "Somme des votes nominatifs = résultat officiel du scrutin",
                  "ok" if not bad_tot else "alerte" if len(bad_tot) <= 20 else "echec", len(bad_tot), "≤ 20", "; ".join(bad_tot[:8])))
    fixed = sum(1 for g in G if g["methode_groupe"] != "publié" and g["groupe"])
    unresolved = sum(1 for g in G if not g["groupe"])
    out.append(_c("E6", "extraction", "Groupes publiés sans identifiant : tous retrouvés", "ok" if unresolved == 0 else "echec", unresolved, 0,
                  f"{fixed} groupes corrigés (identifiant « PO0 » dans la source)"))
    M = read_csv(T / "mandats.csv")
    dates = sorted({s["date"] for s in S})
    worst = (0, "")
    for d in dates[:: max(1, len(dates) // 120)]:
        n = sum(1 for m in M if m["debut"] <= d and (not m["fin"] or m["fin"] >= d))
        if n > worst[0]:
            worst = (n, d)
    out.append(_c("E7", "extraction", "Jamais plus de 577 députés en fonction à une même date", "ok" if worst[0] <= 577 else "echec", worst[0], "≤ 577",
                  f"maximum le {worst[1]} (dates de reprise de fonction des anciens ministres prises en compte)"))
    return out


def check_link(paths: Paths) -> list[dict]:
    T = paths.tables
    out = []
    E = read_csv(T / "scrutins_enrichis.csv")
    n = len(E)
    with_d = sum(1 for e in E if e["dossier"])
    out.append(_c("L1", "rapprochement", "Scrutins rattachés à un dossier législatif", "ok" if with_d / n >= 0.95 else "alerte", f"{with_d / n:.1%}", "≥ 95 %",
                  f"{n - with_d} scrutins sans dossier (motions de censure spontanées, déclarations…)"))
    by_leg = collections.defaultdict(lambda: [0, 0])
    for e in E:
        if e["type"] == "amendement":
            by_leg[e["legislature"]][1] += 1
            by_leg[e["legislature"]][0] += 1 if e["amendement"] else 0
    for leg, (f, t) in sorted(by_leg.items()):
        out.append(_c(f"L2-{leg}", "rapprochement", f"Contenu des amendements retrouvé ({leg}e législature)", "ok" if f / t >= 0.9 else "alerte",
                      f"{f / t:.1%}", "≥ 90 %", f"{f} sur {t} scrutins d'amendement"))
    autre = sum(1 for e in E if e["type"] == "autre")
    out.append(_c("L3", "rapprochement", "Type de vote reconnu", "ok" if autre <= max(5, n // 1000) else "alerte", autre, "≤ 0,1 % « autre »"))
    th = sum(1 for e in E if e["theme"] == "autre")
    out.append(_c("L4", "rapprochement", "Thème attribué", "ok" if th / n <= 0.01 else "alerte", th, "≤ 1 % « autres »"))
    A = {a["uid"]: a for a in read_csv(T / "amendements.csv")}
    wrong = [e["uid"] for e in E if e["amendement"] and A[e["amendement"]]["numero"] != e["numeros_amendement"].split()[0]]
    out.append(_c("L5", "rapprochement", "Numéro de l'amendement retrouvé = numéro cité par le scrutin", "ok" if not wrong else "echec", len(wrong), 0))
    # L6 : l'amendement affiché appartient bien au texte voté (même séance et même numéro ne suffisent pas)
    from s3_link import STRONG_DOSSIER, jaccard, name_tokens
    D = {d["uid"]: d for d in read_csv(T / "dossiers.csv")}
    text_dossier = collections.defaultdict(set)
    for r in read_csv(T / "dossiers_textes.csv"):
        text_dossier[r["texte"]].add(r["dossier"])

    def amd_dossier(a: dict) -> str:
        ds = text_dossier.get(a["texte"], set())
        return a["dossier"] or (next(iter(ds)) if len(ds) == 1 else "")

    incoh = [e["uid"] for e in E if e["amendement"] and e["dossier"] and amd_dossier(A[e["amendement"]]) not in ("", e["dossier"])]
    stats_path = T / "rapprochements.json"
    st = read_json(stats_path) if stats_path.exists() else {}
    corr = "; ".join(f"{k.split(':', 1)[1]} : {v}" for k, v in st.items() if k.startswith(("corrigé:", "écarté:")))
    out.append(_c("L6", "rapprochement", "Amendement affiché et scrutin rattachés au même texte", "ok" if not incoh else "echec", len(incoh), 0,
                  " ; ".join(filter(None, ["; ".join(incoh[:5]), f"corrections appliquées — {corr}" if corr else ""]))))
    # L7 : un rattachement par la séance doit ressembler à l'intitulé ou être confirmé par d'autres scrutins du même texte
    cons = collections.defaultdict(collections.Counter)
    for e in E:
        if e["texte_nom"] and e["dossier"] and e["methode_dossier"] in STRONG_DOSSIER:
            cons[(e["legislature"], fold(e["texte_nom"]))][e["dossier"]] += 1
    doubt = []
    for e in E:
        if e["methode_dossier"] in ("séance", "séance et intitulé", "intitulé") and e["texte_nom"] and e["dossier"]:
            if jaccard(name_tokens(e["texte_nom"]), name_tokens(D[e["dossier"]]["titre"])) < 0.1:
                c = cons.get((e["legislature"], fold(e["texte_nom"])))
                if not c or c.most_common(1)[0][0] != e["dossier"]:
                    doubt.append(e["uid"])
    out.append(_c("L7", "rapprochement", "Rattachements par la séance confirmés (intitulé ou autres scrutins du même texte)", "ok" if not doubt else "alerte",
                  len(doubt), 0, "; ".join(doubt[:5])))
    # L8 : l'auteur (ou un cosignataire) de l'amendement affiché est le député cité par l'intitulé du scrutin
    from s3_link import author_matches, cited_author
    dep_nom = {d["uid"]: fold(d["nom"]).replace("-", " ") for d in read_csv(T / "deputes.csv")}
    titles = {s["uid"]: s["titre"] for s in read_csv(T / "scrutins.csv")}
    n_cited, diff = 0, []
    for e in E:
        cited = cited_author(titles[e["uid"]]) if e["amendement"] else None
        if cited:
            n_cited += 1
            if not author_matches(A[e["amendement"]], cited, dep_nom):
                diff.append(e["uid"])
    share = len(diff) / max(1, n_cited)
    out.append(_c("L8", "rapprochement", "Auteur de l'amendement affiché = député cité par le scrutin (ou cosignataire)",
                  "ok" if share <= 0.005 else "alerte", f"{share:.2%}", "≤ 0,5 %",
                  f"{n_cited - len(diff)} confirmés sur {n_cited} ; écarts connus : l'intitulé cite parfois le député qui a défendu "
                  f"l'amendement plutôt que son premier signataire (numéro, séance, texte et sort concordent) — {', '.join(diff[:6])}"))
    return out


def check_compute(paths: Paths, res: dict) -> list[dict]:
    T = paths.tables
    out = []
    S = {s["uid"]: s for s in res["S"]}
    fails = []
    for uid, field, expected, label in REFERENCE:
        s = S.get(uid)
        got = None if s is None else (int(s[field]) if field in ("pour", "requis") and s[field] != "" else s[field])
        if got != expected:
            fails.append(f"{label} → obtenu {got}")
    pos = collections.defaultdict(dict)
    for g in read_csv(T / "groupes_scrutins.csv"):
        pos[g["scrutin"]][g["groupe"]] = (int(g["pour"]), int(g["contre"]), int(g["abstentions"]))
    for uid, grp, expected, label in REFERENCE_GROUPS:
        if uid in pos and pos[uid].get(grp) != expected:
            fails.append(f"{label} → obtenu {pos[uid].get(grp)}")
    n_ref = len(REFERENCE) + len(REFERENCE_GROUPS)
    out.append(_c("K1", "calcul", "Valeurs de référence vérifiées sur le site de l'Assemblée", "ok" if not fails else "echec",
                  f"{n_ref - len(fails)}/{n_ref}", f"{n_ref}/{n_ref}", " ; ".join(fails)))
    bad = [s["uid"] for s in res["S"] if any(c not in "PCA=-" for c in s["pos"])]
    out.append(_c("K2", "calcul", "Positions de groupe valides (pour, contre, abstention, partagé, aucun vote)", "ok" if not bad else "echec", len(bad), 0))
    G = read_csv(T / "groupes_scrutins.csv")
    diff = 0
    lab = {"pour": "P", "contre": "C", "abstention": "A"}
    for g in G:
        p, c, a = int(g["pour"]), int(g["contre"]), int(g["abstentions"])
        m = max(p, c, a)
        mine = "-" if m == 0 else ("=" if [p, c, a].count(m) > 1 else "PCA"[[p, c, a].index(m)])
        if mine in "PCA" and lab.get(g["position_majoritaire_publiee"]) != mine:
            diff += 1
    out.append(_c("K3", "calcul", "Écart entre nos positions recalculées et le champ « position majoritaire » publié", "alerte" if diff else "ok", diff, "",
                  "Le champ publié n'est pas utilisé : il vaut « pour » par défaut et contredit parfois les décomptes."))
    bad_dep = [d["id"] for d in res["deputies"].values() for L in d["legs"].values() if L["votes"] > L["elig"]]
    out.append(_c("K4", "calcul", "Chaque député vote au plus autant de fois que de scrutins tenus pendant son mandat", "ok" if not bad_dep else "echec", len(bad_dep), 0))
    return out


def check_publish(paths: Paths) -> list[dict]:
    out = []
    big = [p.name for p in paths.site.rglob("*.json") if p.stat().st_size > 15_000_000]
    out.append(_c("P1", "publication", "Chaque fichier publié pèse moins de 15 Mo", "ok" if not big else "echec", len(big), 0, ", ".join(big)))
    return out


def summarize(checks: list[dict]) -> dict:
    c = collections.Counter(x["statut"] for x in checks)
    return {"ok": c["ok"], "alerte": c["alerte"], "echec": c["echec"]}


def write_report(paths: Paths, checks: list[dict]):
    write_json(paths.reports / "controles.json", checks, pretty=True)
    lines = ["# Contrôles automatiques", "", "| Contrôle | Étape | Statut | Valeur | Attendu | Détail |", "|---|---|---|---|---|---|"]
    for x in checks:
        lines.append(f"| {x['id']} {x['titre']} | {x['etape']} | {x['statut']} | {x['valeur']} | {x['attendu']} | {x['detail']} |")
    (paths.reports / "controles.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
