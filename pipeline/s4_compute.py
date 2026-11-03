"""Étape 4 — Calculs.

  • position de chaque famille à chaque scrutin (positions.csv) ;
  • statistiques par député : participation, vote avec son groupe, accord avec chaque famille ;
  • carte des députés (positionnement multidimensionnel sur le taux de désaccord) ;
  • couverture des données (exhaustivité) et analyse de sensibilité des taux d'accord.

Toutes les règles de calcul sont décrites dans METHODOLOGIE.md.
"""
from __future__ import annotations

import collections
import csv
import math
import re

import numpy as np

import config as C
from common import Paths, fold, log, read_csv, write_csv, write_json
from families import FAMILY_IDS, POS_FAMS, POS_INDEX, FamilyMapper

P, Cc, A, N, DOT = ord("P"), ord("C"), ord("A"), ord("N"), ord(".")


def family_position(p: int, c: int, a: int, kind: str, members: int) -> str:
    """Position d'une famille : choix majoritaire parmi ses votants ; égalité = partagé ;
    censure : « pour » si plus de la moitié des membres l'a votée, « contre » sinon."""
    if kind == "censure":
        if members <= 0:
            return "-"
        return "P" if p * 2 > members else "C"
    m = max(p, c, a)
    if m == 0:
        return "-"
    top = [k for k, v in zip("PCA", (p, c, a)) if v == m]
    return top[0] if len(top) == 1 else "="


def load(paths: Paths):
    T = paths.tables
    S = read_csv(T / "scrutins.csv")
    E = {e["uid"]: e for e in read_csv(T / "scrutins_enrichis.csv")}
    for s in S:
        s.update({k: v for k, v in E[s["uid"]].items() if k not in s})
        s["legislature"] = int(s["legislature"])
        s["numero"] = int(s["numero"])
    S.sort(key=lambda s: (s["date"], s["legislature"], s["numero"]))
    for i, s in enumerate(S):
        s["i"] = i
    return S


def run(paths: Paths) -> dict:
    T = paths.tables
    S = load(paths)
    by_uid = {s["uid"]: s for s in S}
    organes = {o["uid"]: o for o in read_csv(T / "organes.csv")}
    fam_of = FamilyMapper(organes)

    # ------------------------------------------------ positions des familles
    agg = collections.defaultdict(lambda: [0, 0, 0, 0, 0])
    unresolved = 0
    for g in read_csv(T / "groupes_scrutins.csv"):
        f = fam_of(g["groupe"])
        if f is None:
            unresolved += 1
            continue
        x = agg[(g["scrutin"], f)]
        x[0] += int(g["pour"])
        x[1] += int(g["contre"])
        x[2] += int(g["abstentions"])
        x[3] += int(g["non_votants"])
        x[4] += int(g["membres"])
    rows = []
    for s in S:
        counts = {f: agg.get((s["uid"], f), [0, 0, 0, 0, 0]) for f in FAMILY_IDS}
        s["famCounts"] = counts
        s["pos"] = "".join(family_position(*counts[f][:3], s["type"], counts[f][4]) for f in POS_FAMS)
        known = {c for c in s["pos"] if c in "PCA"}
        s["contested"] = len(known) > 1
        for f in FAMILY_IDS:
            c = counts[f]
            if c[4]:
                rows.append((s["uid"], f, *c, family_position(*c[:3], s["type"], c[4]) if f in POS_INDEX else ""))
    write_csv(T / "positions.csv", ["scrutin", "famille", "pour", "contre", "abstentions", "non_votants", "membres", "position"], rows)
    log(f"  positions : {len(rows)} lignes, {unresolved} groupes sans famille")

    # ------------------------------------------------ votes → matrices par législature
    deps = {d["uid"]: d for d in read_csv(T / "deputes.csv")}
    leg_rows = collections.defaultdict(list)
    for s in S:
        leg_rows[s["legislature"]].append(s)
    for leg in leg_rows:
        leg_rows[leg].sort(key=lambda s: s["numero"])
    row_of = {}
    for leg, rows_ in leg_rows.items():
        for j, s in enumerate(rows_):
            row_of[s["uid"]] = (leg, j)
    voters = collections.defaultdict(set)
    raw_votes = []
    with open(T / "votes.csv", encoding="utf-8", newline="") as f:
        rd = csv.reader(f)
        next(rd)
        for scrutin, depute, vote, groupe, _deleg in rd:
            if scrutin not in row_of:
                continue
            leg, j = row_of[scrutin]
            voters[leg].add(depute)
            raw_votes.append((leg, j, depute, vote, groupe))

    def sort_key(u):
        d = deps.get(u) or {}
        return (fold(d.get("alpha") or d.get("nom") or u), fold(d.get("prenom") or ""))

    order = {leg: sorted(us, key=sort_key) for leg, us in voters.items()}
    col = {leg: {u: k for k, u in enumerate(us)} for leg, us in order.items()}
    V = {leg: np.full((len(leg_rows[leg]), len(order[leg])), DOT, dtype=np.uint8) for leg in order}
    F = {leg: np.full((len(leg_rows[leg]), len(order[leg])), 255, dtype=np.uint8) for leg in order}
    fam_idx = {f: k for k, f in enumerate(FAMILY_IDS)}
    for leg, j, u, vote, groupe in raw_votes:
        k = col[leg][u]
        V[leg][j, k] = ord(vote)
        fam = fam_of(groupe)
        F[leg][j, k] = fam_idx.get(fam, 255)
    del raw_votes

    # ------------------------------------------------ mandats, partis
    mandats = collections.defaultdict(list)
    for m in read_csv(T / "mandats.csv"):
        mandats[(m["depute"], int(m["legislature"]))].append(m)
    partis = collections.defaultdict(list)
    for p in read_csv(T / "partis.csv"):
        partis[p["depute"]].append(p)

    def party(u):
        ps = partis.get(u)
        if not ps:
            return None
        best = max(ps, key=lambda p: p["debut"] or "")
        return (organes.get(best["parti"]) or {}).get("libelle") or None

    deputies = {}
    for leg, us in order.items():
        rows_ = leg_rows[leg]
        nS = len(rows_)
        dates = np.array([s["date"] for s in rows_])
        is_moc = np.array([s["type"] == "censure" for s in rows_])
        pos_arr = np.array([[ord(c) for c in s["pos"]] for s in rows_], dtype=np.uint8)
        for k, u in enumerate(us):
            vec = V[leg][:, k]
            fams_col = F[leg][:, k]
            voted_rows = np.nonzero(vec != DOT)[0]
            hist = []
            for j in voted_rows:
                fam = FAMILY_IDS[fams_col[j]] if fams_col[j] != 255 else None
                if fam and (not hist or hist[-1][1] != fam):
                    hist.append([rows_[j]["numero"], fam])
            last_fam = FAMILY_IDS[fams_col[voted_rows[-1]]] if len(voted_rows) and fams_col[voted_rows[-1]] != 255 else None
            ms = sorted(mandats.get((u, leg), []), key=lambda m: m["debut_publie"] or "")
            periods = sorted((m["debut"], m["fin"] or "9999-12-31") for m in ms)
            eligible = np.zeros(nS, dtype=bool)
            for d0, d1 in periods:
                eligible |= (dates >= d0) & (dates <= d1)
            voted = np.isin(vec, [P, Cc, A]) & ~is_moc
            eligible |= voted
            agree = []
            for fi in range(len(POS_FAMS)):
                colp = pos_arr[:, fi]
                has = np.isin(colp, [P, Cc, A]) & voted
                agree.append([int((has & (colp == vec)).sum()), int(has.sum())])
            fam_by_row = np.full(nS, -1, dtype=np.int16)
            for h, (num0, fam) in enumerate(hist):
                num1 = hist[h + 1][0] if h + 1 < len(hist) else nS + 1
                fam_by_row[num0 - 1: num1 - 1] = POS_INDEX.get(fam, -1)
            ls = lt = 0
            for j in np.nonzero(voted)[0]:
                fi = fam_by_row[j]
                if fi < 0:
                    continue
                c = pos_arr[j, fi]
                if c in (P, Cc, A):
                    lt += 1
                    ls += int(c == vec[j])
            d = deps.get(u, {"uid": u, "civ": "", "prenom": "", "nom": u, "alpha": u})
            rec = deputies.setdefault(u, {"id": u, "prenom": d["prenom"], "nom": d["nom"], "civ": d["civ"], "alpha": fold(d.get("alpha") or d["nom"]),
                                          "party": party(u), "legs": {}})
            first = ms[0] if ms else {}
            rec["legs"][leg] = {
                "i": k, "fam": last_fam, "hist": hist,
                "dept": first.get("departement") or None, "deptNum": first.get("num_departement") or None, "circo": first.get("circo") or None,
                "from": periods[0][0] if periods else None, "to": (ms[-1]["fin"] or None) if ms else None,
                "fin": (ms[-1]["cause_fin"] or None) if ms else None,
                "per": [[a, None if b == "9999-12-31" else b] for a, b in periods],
                "elig": int((eligible & ~is_moc).sum()), "votes": int(voted.sum()),
                "p": int(((vec == P) & ~is_moc).sum()), "c": int(((vec == Cc) & ~is_moc).sum()), "a": int(((vec == A) & ~is_moc).sum()),
                "nv": int(((vec == N) & ~is_moc).sum()), "cens": int(((vec == P) & is_moc).sum()),
                "loyal": [ls, lt], "agree": agree, "xy": None,
            }
        log(f"  {leg}e : {len(us)} députés")

    maps = {leg: compute_map(leg, leg_rows[leg], order[leg], V[leg], deputies) for leg in order}
    coverage = compute_coverage(paths, S)
    sensitivity = compute_sensitivity(S, T)
    write_json(paths.reports / "couverture.json", coverage, pretty=True)
    write_json(paths.reports / "sensibilite.json", sensitivity, pretty=True)
    return {"S": S, "deputies": deputies, "order": order, "V": V, "maps": maps, "fam_of": fam_of,
            "coverage": coverage, "sensitivity": sensitivity}


# ---------------------------------------------------------------- carte


def compute_map(leg, rows, us, V, deputies, min_votes=100, min_common=25):
    keep_rows = np.array([s["contested"] and s["type"] != "censure" for s in rows])
    vecs = V[keep_rows, :].T  # députés × scrutins
    Pm = (vecs == P).astype(np.float32)
    Cm = (vecs == Cc).astype(np.float32)
    Am = (vecs == A).astype(np.float32)
    Vm = Pm + Cm + Am
    sel = np.nonzero(Vm.sum(1) >= min_votes)[0]
    if len(sel) < 3:
        # petit échantillon (mode essai) : pas de carte plutôt qu'une carte sans signification
        log(f"  carte {leg}e : {len(sel)} député(s) avec au moins {min_votes} votes disputés, carte non calculée")
        return {"n": 0, "explained": [0.0, 0.0], "minVotes": min_votes, "scrutins": int(keep_rows.sum())}
    Pm, Cm, Am, Vm = Pm[sel], Cm[sel], Am[sel], Vm[sel]
    same = Pm @ Pm.T + Cm @ Cm.T + Am @ Am.T
    common = Vm @ Vm.T
    with np.errstate(divide="ignore", invalid="ignore"):
        agree = np.where(common > 0, same / common, np.nan)
    fams = [deputies[us[i]]["legs"][leg]["fam"] for i in sel]
    ok = common >= min_common
    fam_mean = {}
    for fa in set(fams):
        ia = np.array([f == fa for f in fams])
        for fb in set(fams):
            ib = np.array([f == fb for f in fams])
            vals = agree[np.ix_(ia, ib)][ok[np.ix_(ia, ib)]]
            fam_mean[(fa, fb)] = float(np.nanmean(vals)) if vals.size else float(np.nanmean(agree))
    n = len(sel)
    for i in range(n):
        for j in range(n):
            if not ok[i, j]:
                agree[i, j] = fam_mean[(fams[i], fams[j])]
    np.fill_diagonal(agree, 1.0)
    D2 = (1.0 - agree) ** 2
    J = np.eye(n) - np.ones((n, n)) / n
    B = -0.5 * J @ D2 @ J
    w, ev = np.linalg.eigh(B)
    order = np.argsort(w)[::-1]
    w, ev = w[order], ev[:, order]
    X = ev[:, :2] * np.sqrt(np.maximum(w[:2], 0))
    explained = (w[:2] / w[w > 0].sum()).tolist()

    def centroid(fid):
        m = np.array([f == fid for f in fams])
        return X[m].mean(0) if m.any() else None

    cl, cr = centroid("LFI"), centroid("RN")
    if cl is not None and cr is not None:
        v = cr - cl
        ang = math.atan2(v[1], v[0])
        R = np.array([[math.cos(-ang), -math.sin(-ang)], [math.sin(-ang), math.cos(-ang)]])
        X = X @ R.T
        cren = centroid("REN")
        if cren is not None and cren[1] < 0:
            X[:, 1] *= -1
    X = X - X.mean(0)
    X = X / np.abs(X).max()
    for k, i in enumerate(sel):
        deputies[us[i]]["legs"][leg]["xy"] = [round(float(X[k, 0]), 4), round(float(X[k, 1]), 4)]
    log(f"  carte {leg}e : {n} députés, variance expliquée {explained[0]:.0%} / {explained[1]:.0%}")
    return {"n": n, "explained": [round(e, 3) for e in explained], "minVotes": min_votes, "scrutins": int(keep_rows.sum())}


# ---------------------------------------------------------------- couverture


def compute_coverage(paths: Paths, S) -> dict:
    """Exhaustivité : ce qui est publié, ce qui est traité, ce qui manque."""
    T = paths.tables
    amdts = {a["uid"]: a["source"] for a in read_csv(T / "amendements.csv")}
    out = {"legislatures": [], "annees": []}
    for leg in C.LEGISLATURES:
        rows = [s for s in S if s["legislature"] == leg]
        nums = sorted(s["numero"] for s in rows)
        gaps = sorted(set(range(1, nums[-1] + 1)) - set(nums)) if nums else []
        am = [s for s in rows if s["type"] == "amendement"]
        with_amdt = [s for s in am if s["amendement"]]
        out["legislatures"].append({
            "legislature": leg, "premier": rows[0]["date"] if rows else None, "dernier": rows[-1]["date"] if rows else None,
            "scrutins": len(rows), "numeros_manquants": gaps[:50], "n_numeros_manquants": len(gaps),
            "scrutins_avec_dossier": sum(1 for s in rows if s["dossier"]),
            "scrutins_amendement": len(am), "amendements_retrouves": len(with_amdt),
            "amendements_par_source": dict(collections.Counter(amdts.get(s["amendement"], "?") for s in with_amdt)),
        })
    by_year = collections.defaultdict(lambda: collections.Counter())
    for s in S:
        y = s["date"][:4]
        by_year[y]["scrutins"] += 1
        by_year[y]["solennels"] += 1 if s["code_type"] in ("SPS", "MOC") else 0
        by_year[y]["amendements"] += 1 if s["type"] == "amendement" else 0
        by_year[y]["amendements_retrouves"] += 1 if s["type"] == "amendement" and s["amendement"] else 0
    out["annees"] = [{"annee": y, **c} for y, c in sorted(by_year.items())]
    return out


# ---------------------------------------------------------------- sensibilité


DEFINITIONS = [
    ("reference", "Définition retenue : même position (pour, contre ou abstention)"),
    ("demi_abstention", "Une abstention face à un pour ou un contre compte pour un demi-accord"),
    ("sans_abstention", "Seuls les scrutins où les deux ont voté pour ou contre"),
    ("disputes", "Seulement les scrutins où les groupes ne sont pas tous d'accord"),
    ("votes_finaux", "Seulement les votes sur l'ensemble d'un texte"),
    ("poids_par_texte", "Chaque texte pèse autant, quel que soit son nombre de scrutins"),
]


def _spearman(a: list[float], b: list[float]) -> float:
    def ranks(x):
        order = sorted(range(len(x)), key=lambda i: x[i])
        r = [0.0] * len(x)
        for k, i in enumerate(order):
            r[i] = k
        return r
    ra, rb = ranks(a), ranks(b)
    n = len(a)
    if n < 2:
        return 1.0
    d2 = sum((x - y) ** 2 for x, y in zip(ra, rb))
    return 1 - 6 * d2 / (n * (n * n - 1))


def compute_sensitivity(S, T) -> dict:
    """Les conclusions changent-elles si l'on change la définition de l'accord ?"""
    texts_n = collections.Counter(s["texte"] for s in S if s["texte"] != "")
    pos = np.array([[ord(c) for c in s["pos"]] for s in S], dtype=np.uint8)
    contested = np.array([s["contested"] for s in S])
    final = np.array([s["type"] == "ensemble" for s in S])
    weight = np.array([1.0 / texts_n[s["texte"]] if s["texte"] != "" else 1.0 for s in S])
    nf = len(POS_FAMS)
    vote = lambda x: (x == P) | (x == Cc) | (x == A)  # noqa: E731
    res: dict = {"definitions": [{"id": d, "label": lab} for d, lab in DEFINITIONS], "familles": POS_FAMS, "taux": {}, "n": {}, "stabilite": {}}
    for a in range(nf):
        for b in range(nf):
            if a == b:
                continue
            x, y = pos[:, a], pos[:, b]
            both = vote(x) & vote(y)
            same = both & (x == y)
            partial = both & (x != y) & ((x == A) | (y == A))
            pc = both & (x != A) & (y != A)
            vals, ns = [], []
            for mask, num in (
                (both, same.sum()),
                (both, same.sum() + 0.5 * partial.sum()),
                (pc, (pc & (x == y)).sum()),
                (both & contested, (same & contested).sum()),
                (both & final, (same & final).sum()),
            ):
                tot = int(mask.sum())
                vals.append(round(float(num) / tot, 4) if tot else None)
                ns.append(tot)
            wt = float((weight * both).sum())
            vals.append(round(float((weight * same).sum()) / wt, 4) if wt else None)
            ns.append(int(both.sum()))
            key = f"{POS_FAMS[a]}|{POS_FAMS[b]}"
            res["taux"][key] = vals
            res["n"][key] = ns
    for ref in POS_FAMS:
        others = [f for f in POS_FAMS if f != ref and res["taux"][f"{f}|{ref}"][0] is not None]
        base = [res["taux"][f"{f}|{ref}"][0] for f in others]
        res["stabilite"][ref] = []
        for k in range(1, len(DEFINITIONS)):
            alt = [res["taux"][f"{f}|{ref}"][k] for f in others]
            ok = [i for i, v in enumerate(alt) if v is not None]
            res["stabilite"][ref].append(round(_spearman([base[i] for i in ok], [alt[i] for i in ok]), 3))
    return res
