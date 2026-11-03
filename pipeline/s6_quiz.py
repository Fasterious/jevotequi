"""Étape 6 — Quiz « Et toi, tu aurais voté quoi ? ».

Entrée  : pipeline/quiz.toml (formulation des questions, seule partie rédigée à la main),
          tables de l'étape 3 (scrutins, rattachements) et de l'étape 4 (positions des groupes).
Sortie  : web/public/data/quiz.json.

Les positions des groupes ne sont jamais saisies : elles viennent des votes nominatifs, avec la
même règle que le reste du site (position du plus grand nombre). Les contrôles Q1 à Q7 vérifient
les règles de rédaction et l'équilibre de l'ensemble des questions (METHODOLOGIE.md § 14).
"""
from __future__ import annotations

import collections
import re
import tomllib
from pathlib import Path

import config as C
from checks import _c
from common import Paths, fold, log, read_csv, write_json
from families import POS_FAMS, FamilyMapper

QUIZ_FILE = Path(__file__).resolve().parent / "quiz.toml"
MAX_QUESTION, MAX_CONTEXTE = 160, 320
FLIP = {"P": "C", "C": "P"}

# Noms de partis, de groupes et sigles interdits dans les questions et les contextes (règle 3)
_PARTY_WORDS = [r"\brn\b", r"\blfi\b", r"\bps\b", r"\blr\b", r"\bepr\b", r"\budr\b", r"\bliot\b", r"\bgdr\b", r"\bmodem\b",
                r"\bnupes\b", r"\bnfp\b", r"insoumis", r"rassemblement national", r"renaissance", r"republicains", r"socialistes?\b",
                r"ecologistes?\b", r"communistes?\b", r"horizons\b", r"macronist", r"lepenist", r"front national", r"reconquete",
                r"ensemble pour la republique", r"droite republicaine", r"\bdemocrates\b"]
PARTY_RE = re.compile("|".join(_PARTY_WORDS))


def flip(pos: str, inverse: bool) -> str:
    """Position d'un groupe vue depuis la question (« Pour » = pour la mesure décrite)."""
    return FLIP.get(pos, pos) if inverse else pos


def load_questions(path: Path = QUIZ_FILE) -> dict:
    with open(path, "rb") as f:
        return tomllib.load(f)


def run(paths: Paths) -> list[dict]:
    T = paths.tables
    spec = load_questions()
    questions = spec.get("question", [])
    scr = {s["uid"]: s for s in read_csv(T / "scrutins.csv")}
    enr = {e["uid"]: e for e in read_csv(T / "scrutins_enrichis.csv")}
    amd = {a["uid"]: a for a in read_csv(T / "amendements.csv")}
    fam_of = FamilyMapper({o["uid"]: o for o in read_csv(T / "organes.csv")})
    pos = collections.defaultdict(dict)
    for r in read_csv(T / "positions.csv"):
        pos[r["scrutin"]][r["famille"]] = r
    themes = [t[0] for t in C.THEMES]

    out, problems = [], collections.defaultdict(list)
    seen = collections.Counter(q.get("scrutin") for q in questions)
    for q in questions:
        qid, uid = q.get("id", "?"), q.get("scrutin", "")
        s, e = scr.get(uid), enr.get(uid)
        if not s or not e:
            problems["Q1"].append(qid)
            continue
        if seen[uid] > 1:
            problems["Q7"].append(qid)
        inverse = q.get("sens") == "inverse"
        fpos = {f: pos[uid].get(f, {}).get("position", "-") for f in POS_FAMS}
        seen_pos = {flip(p, inverse) for p in fpos.values()}
        if not ({"P", "C"} <= seen_pos):
            problems["Q2"].append(qid)
        text_q, text_c = q.get("question", ""), q.get("contexte", "")
        if not text_q.endswith("?") or len(text_q) > MAX_QUESTION or len(text_c) > MAX_CONTEXTE or not text_c:
            problems["Q3"].append(f"{qid} (longueur ou ponctuation)")
        if PARTY_RE.search(fold(text_q + " " + text_c)):
            problems["Q3"].append(f"{qid} (nom de parti : {PARTY_RE.search(fold(text_q + ' ' + text_c)).group(0)})")
        is_deletion = bool(re.search(r"suppression", s["titre"], re.I)) and e["type"] == "amendement"
        if inverse and not is_deletion:
            problems["Q4"].append(f"{qid} (sens inverse sans amendement de suppression)")
        if is_deletion and not inverse and not re.search(r"supprim", fold(text_q)):
            problems["Q4"].append(f"{qid} (amendement de suppression : question à formuler comme une suppression ou en sens inverse)")
        theme = q.get("theme") or e["theme"]
        if theme not in themes:
            problems["Q1"].append(f"{qid} (thème inconnu {theme})")
        a = amd.get(e["amendement"]) if e["amendement"] else None
        if a and a["type_auteur"] == "Gouvernement":
            author = "GOUV"
        elif a:
            author = fam_of(a["groupe_auteur"]) or "AUTRE"
        elif e["texte_nom"].startswith("projet de loi") or e["type"] == "declaration":
            author = "GOUV"
        else:
            author = None  # proposition de loi : auteur non publié dans les scrutins
        counts = {}
        for f in POS_FAMS:
            r = pos[uid].get(f)
            if r:
                counts[f] = [int(r["pour"]), int(r["contre"]), int(r["abstentions"]), int(r["membres"])]
        out.append({
            "id": qid, "uid": uid, "leg": int(s["legislature"]), "num": int(s["numero"]), "date": s["date"],
            "theme": theme, "kind": e["type"], "q": text_q, "ctx": text_c, "inv": inverse,
            "res": "adopté" if s["sort"].lower().startswith("adopt") else "rejeté",
            "tot": [int(s["pour"] or 0), int(s["contre"] or 0), int(s["abstentions"] or 0)],
            "pos": "".join(fpos[f] for f in POS_FAMS), "n": counts, "author": author,
            "title": s["titre"], "texte": e["texte_nom"], "note": q.get("note", ""), "statut": q.get("statut", "proposé"),
            **({"retired": True} if q.get("statut") == "retiré" else {}),
        })

    # Équilibre de l'ensemble : part des « pour » (vus depuis la question) de chaque groupe
    balance = {}
    for f_i, f in enumerate(POS_FAMS):
        c = collections.Counter(flip(q["pos"][f_i], q["inv"]) for q in out)
        n = c["P"] + c["C"]
        balance[f] = {"pour": c["P"], "contre": c["C"], "abstention": c["A"], "n": n, "part_pour": round(c["P"] / n, 3) if n else None}
    off = [f"{f} {b['part_pour']:.0%}" for f, b in balance.items() if b["n"] >= 10 and not 0.2 <= b["part_pour"] <= 0.8]
    theme_n = collections.Counter(q["theme"] for q in out)
    missing_themes = [t for t in themes if t != "autre" and not theme_n.get(t)]
    adopted = sum(1 for q in out if q["res"] == "adopté")

    checks = [
        _c("Q1", "quiz", "Chaque question renvoie à un scrutin public existant", "ok" if not problems["Q1"] else "echec",
           len(problems["Q1"]), 0, "; ".join(problems["Q1"])),
        _c("Q2", "quiz", "Chaque question départage : au moins un groupe pour et un groupe contre", "ok" if not problems["Q2"] else "echec",
           len(problems["Q2"]), 0, "; ".join(problems["Q2"])),
        _c("Q3", "quiz", "Formulation : question de 160 caractères au plus, contexte présent, aucun nom de parti",
           "ok" if not problems["Q3"] else "echec", len(problems["Q3"]), 0, "; ".join(problems["Q3"])),
        _c("Q4", "quiz", "Amendements de suppression : sens de la question explicite", "ok" if not problems["Q4"] else "echec",
           len(problems["Q4"]), 0, "; ".join(problems["Q4"])),
        _c("Q5", "quiz", "Tous les thèmes sont couverts", "ok" if not missing_themes else "alerte", len(missing_themes), 0,
           ", ".join(missing_themes) or f"{len(out)} questions, {len(theme_n)} thèmes"),
        _c("Q6", "quiz", "Équilibre : aucun groupe toujours « pour » ou toujours « contre » (entre 20 % et 80 %)",
           "ok" if not off else "alerte", len(off), 0,
           "; ".join(off) or ", ".join(f"{f} {b['part_pour']:.0%}" for f, b in balance.items() if b["n"])),
        _c("Q7", "quiz", "Pas deux questions sur le même scrutin", "ok" if not problems["Q7"] else "echec", len(problems["Q7"]), 0,
           "; ".join(problems["Q7"])),
    ]
    write_json(paths.site / "quiz.json", {
        "version": spec.get("version", ""),
        "methodVersion": C.METHOD_VERSION,
        "families": POS_FAMS,
        "questions": out,
        "stats": {"n": len(out), "themes": dict(theme_n), "adopted": adopted, "inverse": sum(q["inv"] for q in out),
                  "legislatures": dict(collections.Counter(q["leg"] for q in out)), "balance": balance},
    })
    log(f"  {len(out)} questions, {len(theme_n)} thèmes, {adopted} textes adoptés, {sum(q['inv'] for q in out)} en sens inverse")
    return checks
