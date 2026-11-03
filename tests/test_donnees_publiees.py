"""Tests sur les données publiées (web/public/data) : valeurs vérifiées à la main sur
assemblee-nationale.fr et propriétés qui doivent toujours être vraies."""
import json
import unittest
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "web" / "public" / "data"


def load(name):
    with open(DATA / name, encoding="utf-8") as f:
        return json.load(f)


def detail(leg, num):
    meta = load("meta.json")
    chunk = next(l["chunk"] for l in meta["legislatures"] if l["num"] == leg)
    return load(f"details/{leg}-{(num - 1) // chunk}.json")[str(num)]


@unittest.skipUnless((DATA / "meta.json").exists(), "données non générées")
class ValeursDeReference(unittest.TestCase):
    def test_censure_barnier(self):
        d = detail(17, 519)
        self.assertEqual(d["tot"][0], 331)
        self.assertEqual(d["requis"], 288)
        self.assertEqual(d["fam"]["RN"][0], 123)
        self.assertEqual(d["fam"]["RN"][4], 124)

    def test_motion_retraites_2023(self):
        d = detail(16, 1240)
        self.assertEqual(d["tot"][0], 278)
        self.assertEqual(d["requis"], 287)

    def test_scrutin_17_3985_socialistes(self):
        self.assertEqual(detail(17, 3985)["fam"]["SOC"][:3], [0, 17, 4])


@unittest.skipUnless((DATA / "meta.json").exists(), "données non générées")
class Proprietes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.meta = load("meta.json")
        cls.s = load("scrutins.json")

    def test_colonnes_de_meme_longueur(self):
        n = len(self.s["num"])
        for k, v in self.s.items():
            self.assertEqual(len(v), n, k)
        self.assertEqual(n, self.meta["counts"]["scrutins"])

    def test_positions(self):
        nf = len(self.meta["positionFamilies"])
        for p in self.s["pos"]:
            self.assertEqual(len(p), nf)
            self.assertTrue(set(p) <= set("PCA=-"))

    def test_ordre_chronologique(self):
        self.assertEqual(self.s["date"], sorted(self.s["date"]))

    def test_censures(self):
        c = load("censures.json")
        self.assertEqual(sum(1 for x in c if x["adopted"]), 1)  # une seule censure adoptée (4 décembre 2024)
        for x in c:
            self.assertIn(x["contextMethod"], (None, "référence publiée", "séance de la motion", "date (probable)"))

    def test_deputes(self):
        for d in load("deputes.json"):
            for L in d["legs"].values():
                self.assertLessEqual(L["votes"], L["elig"])
                self.assertLessEqual(L["loyal"][0], L["loyal"][1])


if __name__ == "__main__":
    unittest.main()


@unittest.skipUnless((DATA / "meta.json").exists(), "données non générées")
class RattachementsCorriges(unittest.TestCase):
    """Cas réels d'erreurs de rattachement corrigées en version 1.1.0 (voir CHANGELOG.md)."""

    def test_zfe_pas_uniforme(self):
        # 12 janvier 2023 : deux propositions de loi dans la même séance, chacune avec un amendement n° 1
        self.assertIn("B0257", detail(16, 827)["amdt"]["uid"])  # ZFE, pas la tenue uniforme (B0254)

    def test_loi_et_loi_organique_examinees_ensemble(self):
        # 7 avril 2025 : même séance, mêmes numéros ; l'auteur cité départage
        self.assertIn("BTC1245", detail(17, 1266)["amdt"]["uid"])

    def test_reference_publiee_erronee(self):
        # la référence de dossier publiée pour ce scrutin désigne un autre texte
        meta_texts = load("texts.json")
        s = load("scrutins.json")
        i = next(k for k in range(len(s["num"])) if s["leg"][k] == 17 and s["num"][k] == 6758)
        self.assertIn("souveraineté agricole", meta_texts["title"][s["text"][i]])

    def test_aucun_amendement_plutot_qu_un_faux(self):
        # le seul amendement n° 3 de la séance appartient à un autre texte : rien n'est affiché
        self.assertIsNone(detail(16, 3367).get("amdt"))


@unittest.skipUnless((DATA / "quiz.json").exists(), "quiz non généré")
class QuizPublie(unittest.TestCase):
    def test_positions_issues_des_votes(self):
        quiz, s = load("quiz.json"), load("scrutins.json")
        idx = {(s["leg"][i], s["num"][i]): i for i in range(len(s["num"]))}
        for q in quiz["questions"]:
            # les positions du quiz sont exactement celles publiées pour le scrutin
            self.assertEqual(q["pos"], s["pos"][idx[(q["leg"], q["num"])]], q["id"])
            self.assertEqual(len(q["pos"]), len(quiz["families"]))

    def test_chaque_question_departage(self):
        quiz = load("quiz.json")
        for q in quiz["questions"]:
            vues = {({"P": "C", "C": "P"}.get(c, c) if q["inv"] else c) for c in q["pos"]}
            self.assertTrue({"P", "C"} <= vues, q["id"])

    def test_zucman(self):
        q = next(q for q in load("quiz.json")["questions"] if q["id"] == "taxe-zucman")
        self.assertEqual(q["tot"][:2], [172, 228])
        self.assertEqual(q["res"], "rejeté")
