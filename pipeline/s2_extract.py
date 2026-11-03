"""Étape 2 — Extraction : archives officielles → tables normalisées (CSV).

Aucune règle éditoriale ici : on recopie les données publiées, sous une forme tabulaire
simple. Les seules corrections (identifiants de groupe manquants « PO0 ») sont tracées :
la valeur publiée est conservée à côté de la valeur corrigée et de la méthode utilisée.

Sorties (data/tables) :
  organes.csv, deputes.csv, mandats.csv, appartenances.csv, partis.csv, gouvernements.csv,
  scrutins.csv, groupes_scrutins.csv, votes.csv,
  dossiers.csv, dossiers_seances.csv, dossiers_votes.csv, dossiers_textes.csv,
  amendements.csv
"""
from __future__ import annotations

import collections
import datetime as dt
import html
import json
import re
import zipfile
from pathlib import Path

import config as C
from common import Paths, as_list, clean_spaces, html_to_text, log, sval, write_csv

# ---------------------------------------------------------------- acteurs et organes


def _acteur_uid(a) -> str:
    u = a["uid"]
    return u["#text"] if isinstance(u, dict) else u


def load_amo(path: Path):
    organes, acteurs = {}, {}
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if "/organe/" in name:
                o = json.loads(z.read(name))["organe"]
                organes[o["uid"]] = o
            elif "/acteur/" in name:
                a = json.loads(z.read(name))["acteur"]
                acteurs[_acteur_uid(a)] = a
    return organes, acteurs


def _mandats(a):
    return as_list((a.get("mandats") or {}).get("mandat"))


def _ident(a):
    i = a["etatCivil"]["ident"]
    return clean_spaces(i.get("prenom")), clean_spaces(i.get("nom")), clean_spaces(i.get("civ")), clean_spaces(i.get("alpha"))


def governments(organes, acteurs, since="2022-05-01"):
    pms = []
    for a in acteurs.values():
        for m in _mandats(a):
            q = (m.get("infosQualite") or {}).get("codeQualite")
            if m.get("typeOrgane") == "MINISTERE" and q == "Premier ministre":
                prenom, nom, civ, _ = _ident(a)
                pms.append({"name": f"{prenom} {nom}", "civ": civ, "from": m["dateDebut"]})
    rows = []
    for o in organes.values():
        if o["codeType"] != "GOUVERNEMENT":
            continue
        start = o["viMoDe"]["dateDebut"]
        if not start or start < since:
            continue
        pm = next((p for p in pms if p["from"] and abs((dt.date.fromisoformat(p["from"]) - dt.date.fromisoformat(start)).days) <= 3), None)
        rows.append([o["uid"], pm["name"] if pm else "", pm["civ"] if pm else "", start, o["viMoDe"]["dateFin"] or ""])
    rows.sort(key=lambda r: r[3])
    counts = collections.Counter(r[1] for r in rows)
    seen = collections.Counter()
    for r in rows:
        seen[r[1]] += 1
        r.append(r[1] + (" " + "I" * seen[r[1]] if counts[r[1]] > 1 else "") if r[1] else "Gouvernement")
    return rows


# ---------------------------------------------------------------- dossiers


def _walk(acts, out):
    for ac in as_list(acts):
        if not ac:
            continue
        out.append(ac)
        sub = ac.get("actesLegislatifs")
        if sub:
            _walk(sub.get("acteLegislatif"), out)


def load_dossiers(path: Path, leg: int):
    dossiers, seances, votes, textes = [], [], [], []
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if "/dossierParlementaire/" not in name:
                continue
            d = json.loads(z.read(name))["dossierParlementaire"]
            acts = []
            _walk((d.get("actesLegislatifs") or {}).get("acteLegislatif"), acts)
            uid = d["uid"]
            com_fond = None
            dates = []
            for ac in acts:
                code = ac.get("codeActe") or ""
                date = (ac.get("dateActe") or "")[:10] if isinstance(ac.get("dateActe"), str) else ""
                if date:
                    dates.append(date)
                if com_fond is None and code.startswith("AN") and code.endswith("-COM-FOND"):
                    com_fond = ac.get("organeRef")
                reunion = ac.get("reunionRef")
                if isinstance(reunion, str) and "DEBATS" in code and reunion.startswith("RUANR5"):
                    seances.append((uid, reunion))
                vr = ac.get("voteRefs")
                if isinstance(vr, dict):
                    for ref in as_list(vr.get("voteRef")):
                        if isinstance(ref, str):
                            votes.append((uid, ref))
                for champ in ("texteAdopte", "texteAssocie"):
                    t = ac.get(champ)
                    if isinstance(t, str):
                        m = re.match(r"^[A-Z]+ANR5L\d+B(TC)?(\d+)", t)
                        if m:
                            textes.append((uid, date, code, champ, t, m.group(2)))
            dossiers.append((uid, leg, clean_spaces(d["titreDossier"]["titre"]), (d.get("procedureParlementaire") or {}).get("libelle"),
                             com_fond or "", min(dates) if dates else "", max(dates) if dates else ""))
    return dossiers, sorted(set(seances)), sorted(set(votes)), textes


# ---------------------------------------------------------------- scrutins


def _gp_timeline(acteurs):
    tl = collections.defaultdict(list)
    for uid, a in acteurs.items():
        for m in _mandats(a):
            if m.get("typeOrgane") == "GP":
                tl[uid].append((m.get("dateDebut") or "0000", m.get("dateFin") or "9999-12-31", m["organes"]["organeRef"]))
    return tl


def _group_at(tl, aref, date):
    for d0, d1, g in tl.get(aref, ()):
        if d0 <= date <= d1:
            return g
    return None


def _resolve_missing_group(g, date, tl, present, leg_groups):
    """Groupe publié sans identifiant (« PO0 ») : retrouvé par l'appartenance de ses votants
    à la date du vote, ou à défaut par l'effectif du groupe."""
    nom = g["vote"].get("decompteNominatif") or {}
    refs = collections.Counter()
    for key in ("pours", "contres", "abstentions", "nonVotants", "nonVotantsVolontaires"):
        block = nom.get(key)
        if block:
            for vt in as_list(block.get("votant")):
                gg = _group_at(tl, vt["acteurRef"], date)
                if gg:
                    refs[gg] += 1
    if refs:
        return refs.most_common(1)[0][0], "appartenance des votants"
    size = int(g["nombreMembresGroupe"])
    sizes = collections.Counter()
    for spans in tl.values():
        for d0, d1, gg in spans:
            if gg in leg_groups - present and d0 <= date <= d1:
                sizes[gg] += 1
    match = [gg for gg, n in sizes.items() if n == size]
    return (match[0], "effectif du groupe") if len(match) == 1 else (None, "non résolu")


def load_scrutins(path: Path, leg: int, organes, tl, sample: int = 0):
    scrutins, groupes, votes = [], [], []
    leg_groups = {o for o, v in organes.items() if v.get("codeType") == "GP" and v.get("legislature") == str(leg)}
    with zipfile.ZipFile(path) as z:
        names = sorted(z.namelist(), key=lambda n: int(re.search(r"V(\d+)\.json$", n).group(1)) if re.search(r"V(\d+)\.json$", n) else 0)
        if sample:  # échantillon régulier + scrutins de référence et du quiz (pour que les contrôles restent probants)
            from checks import REFERENCE, REFERENCE_GROUPS
            from s6_quiz import load_questions

            must = {f"json/{uid}.json" for uid, *_ in REFERENCE + REFERENCE_GROUPS}
            must |= {f"json/{q['scrutin']}.json" for q in load_questions().get("question", [])}  # le quiz aussi
            step = max(1, len(names) // sample)
            names = sorted(set(names[::step][:sample]) | (must & set(names)),
                           key=lambda n: int(re.search(r"V(\d+)\.json$", n).group(1)))
        for name in names:
            s = json.loads(z.read(name))["scrutin"]
            code = s["typeVote"]["codeTypeVote"]
            if code == "SSG" or not s["uid"].startswith("VTANR5"):
                continue  # Congrès (députés + sénateurs) : hors périmètre
            uid = s["uid"]
            raw_groups = as_list(s["ventilationVotes"]["organe"]["groupes"]["groupe"])
            present = {g["organeRef"] for g in raw_groups}
            for g in raw_groups:
                published = g["organeRef"]
                gref, method = published, "publié"
                if published not in organes:
                    gref, method = _resolve_missing_group(g, s["dateScrutin"], tl, present, leg_groups)
                    if gref:
                        present.add(gref)
                v = g["vote"]
                d = v["decompteVoix"]
                nom = v.get("decompteNominatif") or {}
                cnt = collections.Counter()
                for key, vc in (("pours", "P"), ("contres", "C"), ("abstentions", "A"), ("nonVotants", "N"), ("nonVotantsVolontaires", "N")):
                    block = nom.get(key)
                    if not block:
                        continue
                    for vt in as_list(block.get("votant")):
                        votes.append((uid, vt["acteurRef"], vc, gref or "", 1 if vt.get("parDelegation") == "true" else 0))
                        cnt[vc] += 1
                groupes.append((uid, published, gref or "", method, int(g["nombreMembresGroupe"]),
                                int(d["pour"]), int(d["contre"]), int(d["abstentions"]), int(d["nonVotants"]) + int(d.get("nonVotantsVolontaires") or 0),
                                cnt["P"], cnt["C"], cnt["A"], cnt["N"], v.get("positionMajoritaire") or ""))
            syn = s["syntheseVote"]
            dec = syn["decompte"]
            objet = s.get("objet") or {}
            dl = objet.get("dossierLegislatif") or {}
            scrutins.append((uid, leg, int(s["numero"]), s["dateScrutin"], code, s["sort"]["code"], clean_spaces(s["titre"]),
                             s.get("seanceRef") or "", clean_spaces((s.get("demandeur") or {}).get("texte")),
                             (dl.get("dossierRef") if isinstance(dl, dict) else None) or "",
                             int(syn["nombreVotants"]), int(syn["suffragesExprimes"]),
                             int(syn["nbrSuffragesRequis"]) if syn.get("nbrSuffragesRequis") else "",
                             clean_spaces(syn.get("annonce")), int(dec["pour"]), int(dec["contre"]), int(dec["abstentions"]), int(dec["nonVotants"])))
    return scrutins, groupes, votes


# ---------------------------------------------------------------- amendements

AMDT_FILE_RE = re.compile(r"^AMANR5L\d+(PO\d+)")


def _xml_to_obj(el):
    if any(k.endswith("}nil") and v == "true" for k, v in el.attrib.items()):
        return None
    children = list(el)
    if not children:
        return el.text
    out: dict = {}
    for c in children:
        tag = c.tag.split("}", 1)[-1]
        val = _xml_to_obj(c)
        if tag in out:
            out[tag] = out[tag] if isinstance(out[tag], list) else [out[tag]]
            out[tag].append(val)
        else:
            out[tag] = val
    return out


def amendement_row(a: dict, dossier: str | None, source: str):
    ident = a.get("identification") or {}
    num_m = re.search(r"(\d+)", sval(ident.get("numeroOrdreDepot")) or sval(ident.get("numeroLong")) or "")
    if not num_m:
        return None
    sig = a.get("signataires") or {}
    auteur = sig.get("auteur") or {}
    corps = (a.get("corps") or {}).get("contenuAuteur") or {}
    div = ((a.get("pointeurFragmentTexte") or {}).get("division")) or {}
    cyc = a.get("cycleDeVie") or {}
    return (a["uid"], str(int(num_m.group(1))), clean_spaces(sval(ident.get("numeroLong"))), sval(a.get("seanceDiscussionRef")) or "",
            dossier or "", sval(a.get("texteLegislatifRef")) or "", sval(auteur.get("typeAuteur")) or "", sval(auteur.get("acteurRef")) or "",
            sval(auteur.get("groupePolitiqueRef")) or "", clean_spaces(html.unescape(sval(sig.get("libelle")) or "")),
            clean_spaces(sval(div.get("articleDesignation")) or sval(div.get("titre")) or ""), sval(cyc.get("sort")) or "",
            (sval(cyc.get("dateSort")) or "")[:10], html_to_text(sval(corps.get("exposeSommaire"))), html_to_text(sval(corps.get("dispositif"))), source)


AMDT_HEADER = ["uid", "numero", "numero_long", "seance", "dossier", "texte", "type_auteur", "auteur", "groupe_auteur",
               "signataires", "article", "sort", "date_sort", "expose", "dispositif", "source"]


def load_amendements_archive(path: Path, seance_organe: str, wanted: set[str]):
    """Amendements discutés en séance dont le numéro apparaît dans un scrutin."""
    import xml.etree.ElementTree as ET

    rows = []
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            parts = name.split("/")
            if not (name.endswith(".json") or name.endswith(".xml")):
                continue
            m = AMDT_FILE_RE.match(parts[-1])
            if not m or m.group(1) != seance_organe:
                continue
            guess = re.search(r"N0*(\d+)\.(?:json|xml)$", parts[-1])
            if guess and guess.group(1) not in wanted:
                continue
            a = json.loads(z.read(name))["amendement"] if name.endswith(".json") else _xml_to_obj(ET.fromstring(z.read(name)))
            if not isinstance(a, dict):
                continue
            row = amendement_row(a, parts[1] if len(parts) >= 4 and parts[1].startswith("DL") else None, "archive")
            if row and row[1] in wanted:
                rows.append(row)
    return rows


def load_amendements_documents(folder: Path):
    """Amendements récupérés un par un (cache de l'étape « documents »)."""
    rows = []
    if not folder.exists():
        return rows
    for p in sorted(folder.glob("AMANR5L*.json")):
        a = json.loads(p.read_text(encoding="utf-8"))
        if isinstance(a, dict) and a.get("uid"):
            row = amendement_row(a, None, "document")
            if row:
                rows.append(row)
    return rows


# ---------------------------------------------------------------- étape


def run(paths: Paths, sample: int = 0) -> dict:
    T = paths.tables
    raw = paths.raw
    log("extraction : acteurs et organes")
    organes, acteurs = load_amo(raw / "amo30.zip")
    write_csv(T / "organes.csv", ["uid", "code_type", "libelle", "libelle_abrege", "legislature", "debut", "fin", "couleur"],
              ([o["uid"], o["codeType"], clean_spaces(o.get("libelle")), o.get("libelleAbrege") or "", o.get("legislature") or "",
                o["viMoDe"]["dateDebut"] or "", o["viMoDe"]["dateFin"] or "", o.get("couleurAssociee") or ""] for o in organes.values()))
    legs = {str(leg) for leg in C.LEGISLATURES}
    deputes, mandats, apparts, partis = [], [], [], []
    for uid, a in acteurs.items():
        prenom, nom, civ, alpha = _ident(a)
        has_leg = False
        for m in _mandats(a):
            t = m.get("typeOrgane")
            if t == "ASSEMBLEE" and str(m.get("legislature")) in legs:
                has_leg = True
                lieu = ((m.get("election") or {}).get("lieu")) or {}
                mandature = m.get("mandature") or {}
                mandats.append((uid, int(m["legislature"]), sval(mandature.get("datePriseFonction")) or m["dateDebut"], m["dateDebut"], m.get("dateFin") or "",
                                clean_spaces(lieu.get("departement")), lieu.get("numDepartement") or "", lieu.get("numCirco") or "",
                                clean_spaces((m.get("election") or {}).get("causeMandat")), clean_spaces(sval(mandature.get("causeFin")))))
            elif t == "GP" and str(m.get("legislature")) in legs:
                apparts.append((uid, m["organes"]["organeRef"], m.get("dateDebut") or "", m.get("dateFin") or "",
                                (m.get("infosQualite") or {}).get("codeQualite") or ""))
            elif t == "PARPOL":
                partis.append((uid, m["organes"]["organeRef"], m.get("dateDebut") or "", m.get("dateFin") or ""))
        if has_leg:
            deputes.append((uid, civ, prenom, nom, alpha))
    write_csv(T / "deputes.csv", ["uid", "civ", "prenom", "nom", "alpha"], deputes)
    write_csv(T / "mandats.csv", ["depute", "legislature", "debut", "debut_publie", "fin", "departement", "num_departement", "circo", "cause_mandat", "cause_fin"], mandats)
    write_csv(T / "appartenances.csv", ["depute", "groupe", "debut", "fin", "qualite"], apparts)
    write_csv(T / "partis.csv", ["depute", "parti", "debut", "fin"], partis)
    write_csv(T / "gouvernements.csv", ["uid", "premier_ministre", "civ", "debut", "fin", "libelle"], governments(organes, acteurs))

    log("extraction : scrutins")
    tl = _gp_timeline(acteurs)
    all_s, all_g, all_v = [], [], []
    seance_organe = {}
    for leg in C.LEGISLATURES:
        s, g, v = load_scrutins(raw / f"scrutins{leg}.zip", leg, organes, tl, sample)
        all_s += s
        all_g += g
        all_v += v
        with zipfile.ZipFile(raw / f"scrutins{leg}.zip") as z:
            seance_organe[leg] = json.loads(z.read(z.namelist()[0]))["scrutin"]["organeRef"]
        log(f"  {leg}e : {len(s)} scrutins, {len(v)} votes nominatifs")
    write_csv(T / "scrutins.csv", ["uid", "legislature", "numero", "date", "code_type", "sort", "titre", "seance", "demandeur", "dossier_objet",
                                   "votants", "exprimes", "requis", "annonce", "pour", "contre", "abstentions", "non_votants"], all_s)
    write_csv(T / "groupes_scrutins.csv", ["scrutin", "groupe_publie", "groupe", "methode_groupe", "membres", "pour_publie", "contre_publie",
                                           "abstentions_publie", "non_votants_publie", "pour", "contre", "abstentions", "non_votants",
                                           "position_majoritaire_publiee"], all_g)
    write_csv(T / "votes.csv", ["scrutin", "depute", "vote", "groupe", "delegation"], all_v)

    log("extraction : dossiers législatifs")
    D, S, V, X = [], [], [], []
    for leg in C.LEGISLATURES:
        d, s, v, x = load_dossiers(raw / f"dossiers{leg}.zip", leg)
        D += d
        S += s
        V += v
        X += x
    write_csv(T / "dossiers.csv", ["uid", "legislature", "titre", "procedure", "commission", "debut", "fin"], D)
    write_csv(T / "dossiers_seances.csv", ["dossier", "seance"], S)
    write_csv(T / "dossiers_votes.csv", ["dossier", "scrutin"], V)
    write_csv(T / "dossiers_textes.csv", ["dossier", "date", "acte", "champ", "texte", "numero"], X)

    log("extraction : amendements")
    wanted = collections.defaultdict(set)
    for row in all_s:
        title = row[6]
        if re.match(r"^(sur )?(l'|les |le )?(sous-)?am", title.lower().replace("’", "'")):
            nums = re.findall(r"n[°o]\s*(\d+)", title)
            if nums:
                wanted[row[1]].add(str(int(nums[0])))
    rows = []
    for leg in C.LEGISLATURES:
        path = raw / f"amendements{leg}.zip"
        if path.exists():
            try:
                got = load_amendements_archive(path, seance_organe[leg], wanted[leg])
                rows += got
                log(f"  {leg}e : {len(got)} amendements depuis l'archive")
            except (zipfile.BadZipFile, OSError) as e:
                log(f"  ⚠ archive des amendements {leg}e illisible : {e}")
    docs = load_amendements_documents(paths.documents / "amendements")
    known = {r[0] for r in rows}
    docs = [r for r in docs if r[0] not in known]
    rows += docs
    log(f"  {len(docs)} amendements depuis les documents individuels")
    write_csv(T / "amendements.csv", AMDT_HEADER, rows)
    return {"seance_organe": seance_organe}
