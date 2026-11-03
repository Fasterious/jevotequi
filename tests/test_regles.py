"""Tests des règles de classement et de calcul (sans données : rapides, à lancer à chaque modification).

    python3 -I -m unittest discover -s tests -v
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

from s3_link import candidate_uids, classify_kind, extract_text_name, theme_for  # noqa: E402
from s4_compute import family_position  # noqa: E402


class TypeDeVote(unittest.TestCase):
    def test_types_courants(self):
        cas = {
            "l'amendement n° 12 de M. Dupont à l'article 2 du projet de loi de finances pour 2025 (première lecture).": "amendement",
            "le sous-amendement n° 196 de M. Léaument à l'amendement n° 109 de M. Boudié": "amendement",
            "les amendements identiques n° 12, 34 et 56": "amendement",
            "l'article 22 (examen prioritaire) du projet de loi de programmation pour la refondation de Mayotte (première lecture).": "article",
            "l'ensemble du projet de loi pour contrôler l'immigration, améliorer l'intégration (texte de la commission mixte paritaire).": "ensemble",
            "la proposition de loi apportant une réponse intégrale au phénomène des violences sexuelles (première lecture).": "ensemble",
            "la première partie du projet de loi de finances pour 2026 (première lecture).": "partie",
            "la motion de rejet préalable, déposée par Mme Mathilde Panot, du projet de loi de finances pour 2023 (première lecture).": "motion",
            "la déclaration de politique générale du Gouvernement de M. François Bayrou (application de l'article 49, alinéa premier, de la Constitution).": "confiance",
            "la déclaration du Gouvernement portant sur la stratégie de défense nationale (application de l'article 50-1 de la Constitution).": "declaration",
            "la proposition de résolution visant à dénoncer les accords franco-algériens du 27 décembre 1968 (article 34-1 de la Constitution).": "resolution",
            "les crédits de la mission Justice à l'article 35 et État B de la seconde partie du projet de loi de finances pour 2024 (première lecture).": "credits",
            "la demande de suspension de séance présentée par M. Boyard en application de l'article 58 du Règlement": "procedure",
        }
        for titre, attendu in cas.items():
            with self.subTest(titre=titre[:50]):
                self.assertEqual(classify_kind(titre, "SPO"), attendu)

    def test_coquilles_des_intitules_officiels(self):
        # Coquilles réellement présentes dans les données publiées
        self.assertEqual(classify_kind("l'aticle 6 du projet de loi sur la justice criminelle (première lecture).", "SPO"), "article")
        self.assertEqual(classify_kind("l'amenedement n° 187 de M. Renault à l'article 35", "SPO"), "amendement")
        self.assertEqual(classify_kind("le sous-amendmeent n° 776 de Mme Mansouri", "SPO"), "amendement")
        self.assertEqual(classify_kind("Sur la motion de rejet préalable, déposée par Mme Mathilde Panot,", "SPO"), "motion")

    def test_censure_par_code(self):
        self.assertEqual(classify_kind("la motion de censure déposée en application de l'article 49, alinéa 3", "MOC"), "censure")


class Texte(unittest.TestCase):
    def test_extraction(self):
        nom, lecture, debut = extract_text_name("l'amendement n° 12 de M. Dupont à l'article 2 du projet de loi de finances pour 2025 (première lecture).")
        self.assertEqual(nom, "projet de loi de finances pour 2025")
        self.assertEqual(lecture, "première lecture")
        self.assertGreater(debut, 0)

    def test_parenthese_orpheline(self):
        nom, _, _ = extract_text_name("la demande de suspension de séance de Mme Trouvé (projet de loi relatif à la programmation militaire pour les années 2024 à 2030) (première lecture).")
        self.assertEqual(nom, "projet de loi relatif à la programmation militaire pour les années 2024 à 2030")


class Theme(unittest.TestCase):
    def test_mots_cles(self):
        self.assertEqual(theme_for("Projet de loi pour contrôler l'immigration, améliorer l'intégration", None), "immigration")
        self.assertEqual(theme_for("Projet de loi de financement de la sécurité sociale pour 2025", None), "social")
        self.assertEqual(theme_for("Projet de loi de finances pour 2026", None), "budget")
        self.assertEqual(theme_for("Fin de vie", None), "societe")
        self.assertEqual(theme_for("Nationalisation d'ArcelorMittal France", "PO59048"), "economie")

    def test_repli_commission(self):
        self.assertEqual(theme_for("Un intitulé sans mot-clé", "PO59046"), "international")


class PositionDeGroupe(unittest.TestCase):
    def test_majorite_des_votants(self):
        self.assertEqual(family_position(5, 3, 1, "amendement", 20), "P")
        self.assertEqual(family_position(0, 17, 4, "amendement", 69), "C")  # cas du scrutin 17/3985
        self.assertEqual(family_position(1, 1, 6, "article", 30), "A")

    def test_egalite_et_absence(self):
        self.assertEqual(family_position(4, 4, 0, "amendement", 20), "=")
        self.assertEqual(family_position(0, 0, 0, "amendement", 20), "-")

    def test_censure_majorite_des_membres(self):
        self.assertEqual(family_position(123, 0, 0, "censure", 124), "P")
        self.assertEqual(family_position(12, 0, 0, "censure", 23), "P")
        self.assertEqual(family_position(11, 0, 0, "censure", 23), "C")
        self.assertEqual(family_position(0, 0, 0, "censure", 94), "C")


class IdentifiantsAmendement(unittest.TestCase):
    def test_format_et_ordre(self):
        textes = [{"date": "2024-10-01", "acte": "AN1-COM-FOND-RAPPORT", "champ": "texteAdopte", "numero": "0324"},
                  {"date": "2024-09-01", "acte": "AN1-DEPOT", "champ": "texteAssocie", "numero": "0300"},
                  {"date": "2025-01-01", "acte": "AN1-COM-FOND-RAPPORT", "champ": "texteAdopte", "numero": "0999"}]
        c = candidate_uids(textes, "2024-11-15", "43", "PO838901", 17, budget=False)
        self.assertEqual(c[0], "AMANR5L17PO838901BTC0324P0D1N000043")  # texte de commission le plus récent avant le vote
        self.assertNotIn("0999", "".join(c))  # jamais un texte postérieur au vote
        b = candidate_uids(textes, "2024-11-15", "2146", "PO838901", 17, budget=True)
        self.assertEqual(b[0], "AMANR5L17PO838901B0324P1D1N002146")  # budget : parties 1 puis 2 d'abord


if __name__ == "__main__":
    unittest.main()


class RattachementAmendements(unittest.TestCase):
    """Plusieurs textes examinés dans la même séance peuvent avoir des amendements de même numéro."""

    def setUp(self):
        from s3_link import pick_amendment, cited_author, author_matches  # noqa: F401
        self.pick = pick_amendment
        self.tokens = {"DZFE": {"suppression", "zones", "faibles", "emissions", "mobilite"},
                       "DUNI": {"instituer", "ecoles", "colleges", "tenue", "uniforme"}}
        self.zfe = {"uid": "Z1", "dossier": "DZFE", "sort": "Adopté", "auteur": "PA1", "signataires": "Mme Belluco"}
        self.uni = {"uid": "U1", "dossier": "DUNI", "sort": "Adopté", "auteur": "PA1", "signataires": "Mme Belluco"}
        self.name = {"supprimer", "zones", "faibles", "emissions", "mobilite"}

    def test_dossier_publie_strict(self):
        self.assertIs(self.pick([self.uni, self.zfe], "DZFE", None, self.name, self.tokens, "adopté"), self.zfe)
        self.assertIsNone(self.pick([self.uni], "DZFE", None, self.name, self.tokens, "adopté"))

    def test_intitule_departage(self):
        self.assertIs(self.pick([self.uni, self.zfe], None, None, self.name, self.tokens, "adopté"), self.zfe)

    def test_seul_candidat_sans_indice_ecarte(self):
        # le seul amendement n° 1 de la séance appartient à un autre texte : aucun choix plutôt qu'un faux
        self.assertIsNone(self.pick([self.uni], None, None, self.name, self.tokens, "adopté"))

    def test_sort_departage(self):
        # deux textes, même numéro : le sort contradictoire écarte le mauvais candidat
        uni_rej = dict(self.uni, sort="Rejeté")
        self.assertIs(self.pick([uni_rej, self.zfe], None, None, self.name, self.tokens, "adopté"), self.zfe)
        # un candidat seul, du bon texte, n'est pas écarté pour un sort contradictoire dans la source
        zfe_rej = dict(self.zfe, sort="Rejeté")
        self.assertIs(self.pick([zfe_rej], "DZFE", None, self.name, self.tokens, "adopté"), zfe_rej)

    def test_auteur_departage(self):
        from s3_link import cited_author
        a = dict(self.zfe, uid="A", auteur="PA2", signataires="M. Brun")
        b = dict(self.zfe, uid="B", auteur="PA3", signataires="M. Guiniot")
        noms = {"PA2": "brun", "PA3": "guiniot"}
        cited = cited_author("l'amendement de suppression n° 1 de M. Guiniot et les amendements identiques suivants")
        self.assertEqual(cited, "guiniot")
        self.assertIs(self.pick([a, b], None, None, self.name, self.tokens, "adopté", cited, noms), b)

    def test_auteur_cite_sous_amendement(self):
        from s3_link import cited_author
        self.assertIsNone(cited_author("le sous-amendement n° 96 du Gouvernement à l'amendement n° 46 de M. Henriet après l'article 2"))
        self.assertEqual(cited_author("le sous-amendement n° 85 rectifié de Mme Yadan à l'amendement n° 46 de M. Henriet"), "yadan")


class Quiz(unittest.TestCase):
    """Règles du quiz : sens des questions et fichier de questions."""

    def test_sens_inverse(self):
        from s6_quiz import flip
        self.assertEqual(flip("P", True), "C")
        self.assertEqual(flip("C", True), "P")
        self.assertEqual(flip("A", True), "A")
        self.assertEqual(flip("P", False), "P")

    def test_fichier_de_questions(self):
        from s6_quiz import PARTY_RE, load_questions, MAX_QUESTION
        from common import fold
        qs = load_questions()["question"]
        ids = [q["id"] for q in qs]
        self.assertEqual(len(ids), len(set(ids)), "identifiants en double")
        self.assertEqual(len({q["scrutin"] for q in qs}), len(qs), "deux questions sur le même scrutin")
        for q in qs:
            self.assertTrue(q["question"].endswith("?"), q["id"])
            self.assertLessEqual(len(q["question"]), MAX_QUESTION, q["id"])
            self.assertIsNone(PARTY_RE.search(fold(q["question"] + " " + q["contexte"])), q["id"])
            self.assertIn(q.get("sens", "direct"), ("direct", "inverse"), q["id"])
