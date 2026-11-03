"""Étape 3 — Classement et rapprochements.

Pour chaque scrutin :
  • type de vote (amendement, article, vote final, censure…) — déduit de l'intitulé officiel ;
  • texte voté (dossier législatif) — par ordre de fiabilité : référence publiée dans le
    scrutin, référence publiée dans le dossier (voteRefs), dossier de l'amendement voté,
    séance + intitulé, intitulé seul ;
  • amendement voté — par séance + numéro (archive ou document individuel), sinon par
    dossier + numéro ;
  • thème — mots-clés du titre du dossier, sinon commission saisie au fond.
Chaque rapprochement indique sa méthode (colonnes methode_*), pour pouvoir l'auditer.

Sorties : scrutins_enrichis.csv, textes.csv, amendements_manquants.csv
"""
from __future__ import annotations

import collections
import datetime as dt
import difflib
import html
import re

import config as C
from common import Paths, clean_spaces, fold, log, read_csv, write_csv, write_json

READING_RE = re.compile(
    r"\s*\(((?:premi[eè]re|deuxi[eè]me|troisi[eè]me|nouvelle) lecture|lecture d[ée]finitive|"
    r"texte de la commission mixte paritaire|texte de la CMP|CMP)\)\s*\.?\s*$",
    re.I,
)
TEXT_START_RE = re.compile(r"\b(projets? de loi|propositions? de loi|propositions? de r[ée]solution)\b", re.I)


def split_reading(title: str):
    t = clean_spaces(title).rstrip()
    m = READING_RE.search(t)
    reading = None
    if m:
        reading = m.group(1)
        t = t[: m.start()]
    return t.rstrip(" ."), reading


def extract_text_name(title: str):
    """« … du projet de loi de finances pour 2025 (première lecture). » →
    ('projet de loi de finances pour 2025', 'première lecture', position du début)."""
    base, reading = split_reading(title)
    m = TEXT_START_RE.search(base)
    if not m:
        return None, reading, None
    name = base[m.start():].strip(" .")
    if name.count(")") > name.count("("):
        name = name[: name.rfind(")")].strip()
    if len(name) < 15:
        return None, reading, None
    return name, reading, m.start()


def classify_kind(title: str, code: str) -> str:
    t = re.sub(r"^sur ", "", fold(title))
    first = re.match(r"^(l'|les |le |la )?([a-z\-]+)", t)
    word = first.group(2) if first else ""
    if code == "MOC" or t.startswith("la motion de censure"):
        return "censure"
    if "declaration de politique generale" in t or re.search(r"article 49, alinea (premier|1)", t):
        return "confiance"
    if t.startswith("la declaration du gouvernement") or "article 50-1" in t:
        return "declaration"
    if re.match(r"^l'ensemble\b", t) or re.match(r"^(le projet|la proposition) de loi\b", t):
        return "ensemble"
    if re.match(r"^la (premiere|deuxieme|seconde|troisieme|quatrieme) partie\b", t):
        return "partie"
    if word.startswith("am") or word.startswith("sous-am"):
        return "amendement"
    if word.startswith("art") or word in ("aticle", "articles", "aticles"):
        return "article"
    if t.startswith("les credits") or t.startswith("le credit"):
        return "credits"
    if t.startswith("la motion"):
        return "motion"
    if t.startswith("la proposition de resolution") or t.startswith("la resolution"):
        return "resolution"
    if (t.startswith("la demande") or "suspension de seance" in t or "seconde deliberation" in t
            or "prolonger la seance" in t or t.startswith("la proposition du gouvernement")):
        return "procedure"
    return "autre"


def theme_for(text: str | None, commission: str | None) -> str:
    t = fold(text)
    if t:
        for theme, patterns in C.THEME_RULES:
            for p in patterns:
                if re.search(p, t):
                    return theme
    if commission and commission in C.COMMISSION_THEME:
        return C.COMMISSION_THEME[commission]
    return "autre"


_STOP = {"de", "la", "le", "les", "des", "du", "a", "au", "aux", "et", "en", "l", "d", "pour", "sur", "par",
         "un", "une", "projet", "proposition", "loi", "visant", "relatif", "relative", "portant", "dans"}


def name_tokens(s: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", fold(s)) if w not in _STOP and len(w) > 1}


def jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if a and b else 0.0


def candidate_uids(texts: list[dict], date: str, num: str, organe: str, leg: int, budget: bool, limit: int = 16) -> list[str]:
    """Identifiants d'amendement plausibles, dans l'ordre d'essai validé sur la 17e législature
    (identifiant juste parmi les candidats dans 100 % des 8 006 cas testés, en 1,5 essai en moyenne)."""
    ranked = []
    for t in texts:
        if t["date"] and t["date"] > date:
            continue
        prio = 0 if ("COM-FOND-RAPPORT" in t["acte"] and t["champ"] == "texteAdopte") else 1 if "DEPOT" in t["acte"] else 2
        ranked.append((prio, t["date"], t["numero"]))
    ranked.sort(key=lambda r: (r[0], tuple(-ord(c) for c in r[1])))
    variants = [("", 1), ("", 2), ("TC", 0), ("", 0)] if budget else [("TC", 0), ("", 0), ("", 1), ("", 2)]
    out, seen = [], set()
    for _, _, tnum in ranked:
        for tc, p in variants:
            uid = f"AMANR5L{leg}{organe}B{tc}{tnum}P{p}D1N{int(num):06d}"
            if uid not in seen:
                seen.add(uid)
                out.append(uid)
    return out[:limit]


def outcome_consistent(amdt: dict, result: str) -> bool:
    """Le sort de l'amendement ne contredit pas le résultat du scrutin. « Non soutenu »,
    « retiré » ou « tombé » restent possibles : le scrutin porte alors sur les amendements
    identiques, de même contenu."""
    so, res = (amdt.get("sort") or "").lower(), (result or "").lower()
    if so.startswith("adopt"):
        return res.startswith("adopt")
    if so.startswith("rejet"):
        return res.startswith("rejet")
    return True


_UP = "A-ZÉÈÊËÀÂÎÏÔÛÙÇŒ"
CITED_RE = re.compile(
    r"n[°o]\s*\d+\s*(?:\(rect\.\)\s*|rectifiée?\s+)?(?:(du Gouvernement|de la commission)|(?:de|du)\s+(?:(?:M\.|Mme)\s+)?"
    rf"((?:d[’']|(?:de|du|des|le|la|Le|La|Les)\s+)*[{_UP}][^\s,]*(?:[\s-](?:d[’']|(?:de|du|des|le|la|Le|La)\s+)?[{_UP}][^\s,]*)*))")


def cited_author(title: str) -> str | None:
    """Nom du député cité par l'intitulé du scrutin (« l'amendement n° 12 de Mme X… »)."""
    m = CITED_RE.search(title)  # premier numéro cité seulement (un sous-amendement cite aussi l'amendement parent)
    w = [x for x in _words(m.group(2)) if len(x) > 2] if m and m.group(2) else []
    return " ".join(w) or None


def _words(text: str) -> list[str]:
    return re.findall(r"[a-z]+", fold(html.unescape(text or "")))


def author_matches(amdt: dict, cited: str, dep_nom: dict) -> bool:
    """Auteur ou cosignataire = député cité (tolère les fautes de frappe des intitulés)."""
    words = cited.split()
    nom = _words(dep_nom.get(amdt.get("auteur", ""), ""))
    if nom and (any(w in nom for w in words) or difflib.SequenceMatcher(None, words[-1], nom[-1]).ratio() >= 0.8):
        return True
    sig = _words(amdt.get("signataires"))
    return words[-1] in sig


def pick_amendment(cands: list[dict], strong: str | None, weak: str | None, name_tk: set, dossier_tokens: dict,
                   result: str = "", cited: str | None = None, dep_nom: dict | None = None) -> dict | None:
    """Choisit, parmi les amendements discutés dans la séance du scrutin et portant le numéro
    cité, celui du bon texte. Plusieurs textes peuvent être examinés dans une même séance avec
    des numéros identiques (journée réservée à un groupe, loi et loi organique examinées ensemble).

    1. Filtres stricts : dossier de la référence publiée (`strong`) s'il y en a une ; sort
       cohérent avec le résultat (adopté / rejeté) dès que les candidats viennent de textes
       différents (la source enregistre parfois un sort contradictoire pour le bon amendement).
    2. Auteur cité par l'intitulé : s'il désigne certains candidats, on ne garde qu'eux.
    3. Parmi les restants : le dossier suggéré par la séance (`weak`), sinon le titre de dossier
       le plus proche de l'intitulé, sinon un dossier unique.
    4. Un candidat sans aucun élément en sa faveur (ni auteur, ni dossier, ni ressemblance
       d'intitulé) est écarté. Aucun choix plutôt qu'un mauvais choix : le scrutin part alors en
       recherche document par document."""
    consistent = [c for c in cands if outcome_consistent(c, result)]
    if consistent or len({c["dossier"] for c in cands}) > 1:
        cands = consistent  # le sort départage ; un candidat seul n'est pas écarté pour un sort contradictoire dans la source
    if strong:
        cands = [c for c in cands if c["dossier"] in (strong, "")]
    if not cands:
        return None
    by_author = [c for c in cands if cited and dep_nom is not None and author_matches(c, cited, dep_nom)]
    if by_author:
        cands = by_author

    def evidence(c: dict) -> float:
        if c["dossier"] and c["dossier"] in (strong, weak):
            return 2.0
        return jaccard(name_tk, dossier_tokens.get(c["dossier"], set()))

    if len({c["dossier"] for c in cands}) == 1:
        c = cands[0]
        return c if (by_author or strong or evidence(c) > 0 or not c["dossier"]) else None
    scored = sorted(((evidence(c), -i) for i, c in enumerate(cands)), reverse=True)
    if scored[0][0] > 0 and scored[0][0] > scored[1][0]:
        return cands[-scored[0][1]]
    return None


STRONG_DOSSIER = {"référence du scrutin", "référence du dossier", "dossier de l'amendement"}


def run(paths: Paths, seance_organe: dict[int, str]) -> dict:
    T = paths.tables
    scrutins = read_csv(T / "scrutins.csv")
    dossiers = {d["uid"]: d for d in read_csv(T / "dossiers.csv")}
    seance_dossiers = collections.defaultdict(set)
    for r in read_csv(T / "dossiers_seances.csv"):
        seance_dossiers[r["seance"]].add(r["dossier"])
    vote_dossiers = collections.defaultdict(list)
    for r in read_csv(T / "dossiers_votes.csv"):
        vote_dossiers[r["scrutin"]].append(r["dossier"])

    def is_engagement(uid: str) -> bool:
        return dossiers.get(uid, {}).get("titre", "").lower().startswith("engagement de la responsabilit")

    def referenced_dossier(scrutin_uid: str, kind: str) -> str | None:
        """Un scrutin peut être cité par plusieurs dossiers (ex. une motion de censure : le texte
        visé et l'engagement de responsabilité). Règle : pour une censure, l'engagement ; sinon le
        premier dossier dans l'ordre des identifiants (choix déterministe)."""
        ds = sorted(d for d in vote_dossiers.get(scrutin_uid, []) if d in dossiers)
        if not ds:
            return None
        if kind == "censure":
            eng = [d for d in ds if is_engagement(d)]
            if eng:
                return eng[0]
        return ds[0]
    dossier_texts = collections.defaultdict(list)
    text_dossier = collections.defaultdict(set)
    for r in read_csv(T / "dossiers_textes.csv"):
        dossier_texts[r["dossier"]].append(r)
        text_dossier[r["texte"]].add(r["dossier"])
    amdts = read_csv(T / "amendements.csv")
    # Les amendements récupérés un par un indiquent leur texte mais pas leur dossier :
    # on le déduit du texte (sans ambiguïté seulement).
    for a in amdts:
        if not a["dossier"] and len(text_dossier.get(a["texte"], ())) == 1:
            a["dossier"] = next(iter(text_dossier[a["texte"]]))
    by_seance = collections.defaultdict(list)
    by_dossier = collections.defaultdict(list)
    for a in amdts:
        if a["seance"]:
            by_seance[(a["seance"], a["numero"])].append(a)
        if a["dossier"]:
            by_dossier[(a["dossier"], a["numero"])].append(a)
    dossier_tokens = {u: name_tokens(d["titre"]) for u, d in dossiers.items()}
    dep_nom = {d["uid"]: fold(d["nom"]).replace("-", " ") for d in read_csv(T / "deputes.csv")}
    by_title = collections.defaultdict(list)
    for d in dossiers.values():
        by_title[(d["legislature"], fold(d["titre"]).strip(" ."))].append(d["uid"])

    stats = collections.Counter()
    enriched, missing = [], []
    for s in scrutins:
        kind = classify_kind(s["titre"], s["code_type"])
        name, reading, start = extract_text_name(s["titre"])
        nums = [str(int(x)) for x in re.findall(r"n[°o]\s*(\d+)", s["titre"])] if kind == "amendement" else []
        dossier, how = None, ""
        if s["dossier_objet"] in dossiers:
            dossier, how = s["dossier_objet"], "référence du scrutin"
        elif referenced_dossier(s["uid"], kind):
            dossier, how = referenced_dossier(s["uid"], kind), "référence du dossier"
        amdt, amdt_how = None, ""
        if nums:
            # dossier suggéré par la séance (seul, ou désigné par l'intitulé) quand rien n'est publié
            weak = None
            sd = sorted(seance_dossiers.get(s["seance"], ()))
            if dossier is None and name and len(sd) == 1:
                weak = sd[0]
            elif dossier is None and name and len(sd) > 1:
                tk = name_tokens(name)
                best = max(sd, key=lambda u: jaccard(tk, dossier_tokens[u]))
                weak = best if jaccard(tk, dossier_tokens[best]) >= 0.3 else None
            cands = by_seance.get((s["seance"], nums[0]), [])
            amdt = pick_amendment(cands, dossier, weak, name_tokens(name) if name else set(), dossier_tokens,
                                  s["sort"], cited_author(s["titre"]), dep_nom)
            if amdt:
                amdt_how = "séance et numéro"
            elif cands:
                stats["écarté:amendement d'un autre texte (même séance, même numéro)"] += 1
        if dossier is None:
            cands = sorted(seance_dossiers.get(s["seance"], ()))
            if amdt and amdt["dossier"] in dossiers:
                dossier, how = amdt["dossier"], "dossier de l'amendement"
            elif len(cands) == 1 and name:
                dossier, how = cands[0], "séance"
            elif len(cands) > 1 and name:
                tk = name_tokens(name)
                best = max(cands, key=lambda u: jaccard(tk, dossier_tokens[u]))
                if jaccard(tk, dossier_tokens[best]) >= 0.3:
                    dossier, how = best, "séance et intitulé"
        if dossier is None and name:
            key = (s["legislature"], fold(name).strip(" ."))
            if len(by_title.get(key, [])) == 1:
                dossier, how = by_title[key][0], "intitulé"
        if amdt is None and nums and dossier:
            # même dossier et même numéro : seulement le même jour (±1, séances de nuit) et avec un
            # sort cohérent — un numéro peut exister à chaque lecture du texte.
            d0 = dt.date.fromisoformat(s["date"])
            cands = [c for c in by_dossier.get((dossier, nums[0]), [])
                     if c["date_sort"] and abs((dt.date.fromisoformat(c["date_sort"]) - d0).days) <= 1
                     and outcome_consistent(c, s["sort"]) and (c.get("sort") or "").lower().startswith(("adopt", "rejet"))]
            if cands:
                cands = sorted(cands, key=lambda c: abs((dt.date.fromisoformat(c["date_sort"]) - d0).days))
                amdt, amdt_how = cands[0], "dossier et numéro"
        # motion de censure : article et texte visé (du plus sûr au moins sûr)
        article, contexte, contexte_methode = "", "", ""
        if kind == "censure":
            t = fold(s["titre"])
            article = "49-3" if re.search(r"article 49,? alinea 3", t) else ("49-2" if re.search(r"alinea 2", t) else "")
            eng = dossier if dossier and is_engagement(dossier) else None
            if eng:
                contexte_methode = "référence publiée"
            elif article == "49-3":
                eng_seance = sorted(u for u in seance_dossiers.get(s["seance"], ()) if is_engagement(u))
                if len(eng_seance) == 1:
                    eng, contexte_methode = eng_seance[0], "séance de la motion"
                    if not dossier:
                        dossier, how = eng, "séance de la motion de censure"
                else:
                    # Dernier recours, signalé comme « probable » : l'engagement le plus récent
                    # dans les 12 jours précédant le vote. Ne crée pas de rattachement.
                    d0 = dt.date.fromisoformat(s["date"])
                    cands = [u for u, d in dossiers.items() if is_engagement(u) and d["legislature"] == s["legislature"] and d["debut"]
                             and 0 <= (d0 - dt.date.fromisoformat(d["debut"])).days <= 12]
                    if cands:
                        eng, contexte_methode = max(cands, key=lambda u: (dossiers[u]["debut"], u)), "date (probable)"
            if eng:
                ctx = re.sub(r"^engagement de la responsabilit[ée] du gouvernement\s+(sur\s+)+", "", dossiers[eng]["titre"], flags=re.I)
                contexte = ctx[0].upper() + ctx[1:]
        enriched.append({
            "uid": s["uid"], "legislature": s["legislature"], "numero": s["numero"], "date": s["date"], "type": kind,
            "texte_nom": name or "", "lecture": reading or "", "debut_texte": "" if start is None else start,
            "numeros_amendement": " ".join(nums), "dossier": dossier or "", "methode_dossier": how,
            "amendement": amdt["uid"] if amdt else "", "methode_amendement": amdt_how,
            "article_censure": article, "contexte_censure": contexte, "methode_contexte": contexte_methode,
            "_seance": s["seance"], "_sort": s["sort"], "_cited": cited_author(s["titre"]),
        })

    # --- Contrôle croisé des rattachements ------------------------------------------------
    # 1. Un même intitulé de texte renvoie au même dossier : un rattachement qui ne ressemble pas
    #    à l'intitulé et contredit la grande majorité des scrutins du même texte est corrigé
    #    (la référence publiée par l'Assemblée est parfois erronée).
    # 2. Un rattachement faible (par la séance) sans ressemblance d'intitulé, non confirmé par
    #    d'autres scrutins du même texte, est retiré : aucun rattachement plutôt qu'un faux.
    # 3. Un amendement dont le texte n'appartient pas au dossier du scrutin est retiré.
    consensus = collections.defaultdict(collections.Counter)
    for e in enriched:
        if e["texte_nom"] and e["dossier"] and e["methode_dossier"] in STRONG_DOSSIER:
            consensus[(e["legislature"], fold(e["texte_nom"]))][e["dossier"]] += 1
    for e in enriched:
        if not e["texte_nom"] or not e["dossier"] or e["type"] == "censure":
            continue
        tk = name_tokens(e["texte_nom"])
        j_cur = jaccard(tk, dossier_tokens[e["dossier"]])
        if j_cur >= 0.1:
            continue
        c = consensus.get((e["legislature"], fold(e["texte_nom"])), collections.Counter())
        top, n_top = c.most_common(1)[0] if c else (None, 0)
        if top == e["dossier"]:
            continue
        if top and n_top >= 3 and n_top >= 0.8 * sum(c.values()) and jaccard(tk, dossier_tokens[top]) > j_cur:
            e["dossier"], e["methode_dossier"] = top, "intitulé (autres scrutins du même texte)"
            stats["corrigé:dossier remplacé"] += 1
            nums = e["numeros_amendement"].split()
            if nums and not e["amendement"]:  # nouvel essai avec le bon dossier
                a = pick_amendment(by_seance.get((e["_seance"], nums[0]), []), top, None, tk, dossier_tokens,
                                   e["_sort"], e["_cited"], dep_nom)
                if a:
                    e["amendement"], e["methode_amendement"] = a["uid"], "séance et numéro"
        elif e["methode_dossier"] not in STRONG_DOSSIER:
            e["dossier"], e["methode_dossier"] = "", ""
            stats["corrigé:dossier retiré"] += 1
    # nouvel essai pour les amendements non trouvés : dossier désigné par les autres scrutins du même texte
    for e in enriched:
        nums = e["numeros_amendement"].split()
        if not nums or e["amendement"] or not e["texte_nom"]:
            continue
        c = consensus.get((e["legislature"], fold(e["texte_nom"])), collections.Counter())
        top, n_top = c.most_common(1)[0] if c else (None, 0)
        if not top or n_top < 3 or n_top < 0.8 * sum(c.values()):
            continue
        strong = e["dossier"] if e["methode_dossier"] in STRONG_DOSSIER else None
        a = pick_amendment(by_seance.get((e["_seance"], nums[0]), []), strong, top, name_tokens(e["texte_nom"]), dossier_tokens,
                           e["_sort"], e["_cited"], dep_nom)
        if a:
            e["amendement"], e["methode_amendement"] = a["uid"], "séance et numéro"
            if not e["dossier"] and a["dossier"] in dossiers:
                e["dossier"], e["methode_dossier"] = a["dossier"], "dossier de l'amendement"
            stats["corrigé:amendement retrouvé grâce aux autres scrutins du même texte"] += 1
    amd_by_uid = {a["uid"]: a for a in amdts}
    for e in enriched:
        if e["amendement"] and e["dossier"]:
            ad = amd_by_uid[e["amendement"]]["dossier"]
            if ad and ad != e["dossier"]:
                e["amendement"], e["methode_amendement"] = "", ""
                stats["corrigé:amendement d'un autre texte retiré"] += 1
    for e in enriched:
        stats[f"dossier:{e['methode_dossier'] or 'aucun'}"] += 1
        if e["type"] == "amendement":
            stats[f"amendement:{e['methode_amendement'] or 'introuvable'}"] += 1
        nums = e["numeros_amendement"].split()
        if not nums or e["amendement"]:
            continue
        leg = int(e["legislature"])
        dl = [e["dossier"]] if e["dossier"] else sorted(seance_dossiers.get(e["_seance"], ()))[:2]
        cand = []
        for d in dl:
            budget = bool(re.search(r"loi de finances|financement de la s[ée]curit[ée] sociale", dossiers[d]["titre"], re.I))
            cand += candidate_uids(dossier_texts.get(d, []), e["date"], nums[0], seance_organe[leg], leg, budget)
        missing.append((e["uid"], leg, e["date"], e["_seance"], nums[0], e["dossier"], e["_sort"], "|".join(cand)))

    # textes : regroupement des scrutins par dossier (ou par intitulé à défaut)
    texts, index = [], {}
    for e in enriched:
        key = e["dossier"] or (("T", e["legislature"], fold(e["texte_nom"])) if e["texte_nom"] else None)
        if key is None:
            e["texte"] = ""
            continue
        if key not in index:
            if e["dossier"]:
                d = dossiers[e["dossier"]]
                title, com, proc = d["titre"], d["commission"], d["procedure"]
            else:
                title, com, proc = e["texte_nom"][0].upper() + e["texte_nom"][1:], "", ""
            index[key] = len(texts)
            texts.append({"id": len(texts), "titre": title, "dossier": e["dossier"], "legislature": e["legislature"],
                          "commission": com, "procedure": proc, "n": 0, "premier": e["date"], "dernier": e["date"]})
        t = texts[index[key]]
        e["texte"] = t["id"]
        t["n"] += 1
        t["premier"] = min(t["premier"], e["date"])
        t["dernier"] = max(t["dernier"], e["date"])
    for t in texts:
        t["theme"] = theme_for(t["titre"], t["commission"])
    titles = {s["uid"]: s["titre"] for s in scrutins}
    for e in enriched:
        if e["texte"] != "":
            e["theme"] = texts[e["texte"]]["theme"]
        elif e["type"] in ("censure", "confiance"):
            e["theme"] = "institutions"
        else:  # scrutin sans texte identifié : thème d'après son intitulé
            e["theme"] = theme_for(titles[e["uid"]], None)

    cols = ["uid", "legislature", "numero", "date", "type", "texte_nom", "lecture", "debut_texte", "numeros_amendement",
            "dossier", "methode_dossier", "texte", "theme", "amendement", "methode_amendement", "article_censure", "contexte_censure",
            "methode_contexte"]
    write_csv(T / "scrutins_enrichis.csv", cols, ([e[c] for c in cols] for e in enriched))
    tcols = ["id", "titre", "dossier", "legislature", "commission", "procedure", "theme", "n", "premier", "dernier"]
    write_csv(T / "textes.csv", tcols, ([t[c] for c in tcols] for t in texts))
    write_csv(T / "amendements_manquants.csv", ["scrutin", "legislature", "date", "seance", "numero", "dossier", "sort", "candidats"], missing)
    write_json(T / "rapprochements.json", dict(sorted(stats.items())), pretty=True)
    log(f"  rapprochements : {dict(sorted(stats.items()))}")
    log(f"  {len(texts)} textes, {len(missing)} amendements à compléter")
    return {"stats": dict(stats)}
