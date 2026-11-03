"""Configuration du pipeline : sources, familles politiques, thèmes, types de scrutin.

Tout ce qui relève d'un *choix éditorial* (regroupement des groupes en familles,
classement thématique) est centralisé ici pour être relu et discuté facilement.
"""

# Version de la méthode : à incrémenter (et à décrire dans CHANGELOG.md) dès qu'une règle de
# calcul, de classement ou de rattachement change. Elle est publiée avec les données.
METHOD_VERSION = "1.1.0"

LEGISLATURES = [16, 17]

BASE = "https://data.assemblee-nationale.fr/static/openData/repository"

SOURCES = {
    "amo30": f"{BASE}/17/amo/tous_acteurs_mandats_organes_xi_legislature/"
    "AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip",
    "scrutins16": f"{BASE}/16/loi/scrutins/Scrutins.json.zip",
    "scrutins17": f"{BASE}/17/loi/scrutins/Scrutins.json.zip",
    "dossiers16": f"{BASE}/16/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip",
    "dossiers17": f"{BASE}/17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip",
    # Archive JSON de la 16e partiellement illisible sur le serveur (nov. 2026) : variante XML, mêmes données.
    "amendements16": f"{BASE}/16/loi/amendements_div_legis/Amendements.xml.zip",
    "amendements17": f"{BASE}/17/loi/amendements_div_legis/Amendements.json.zip",
}

# Sources dont l'absence n'arrête pas le pipeline (complétées document par document).
OPTIONAL_SOURCES = {"amendements16", "amendements17"}

# ---------------------------------------------------------------------------
# Familles politiques.
# Un « groupe » est propre à une législature (ex. Renaissance en 16e, EPR en 17e) ;
# une « famille » relie les groupes d'une même formation d'une législature à l'autre.
# Ordre = placement approximatif dans l'hémicycle, de la gauche vers la droite.
# `match` sert de filet de sécurité si un nouveau groupe apparaît (renommage…).
# ---------------------------------------------------------------------------
FAMILIES = [
    {
        "id": "GDR", "short": "GDR", "name": "Gauche démocrate et républicaine",
        "desc": "Communistes et députés ultramarins de gauche",
        "groups": ["PO800502", "PO845514"], "match": r"gauche d[ée]mocrate",
    },
    {
        "id": "LFI", "short": "LFI", "name": "La France insoumise",
        "desc": "Groupe LFI-NUPES (2022-2024) puis LFI-NFP",
        "groups": ["PO800490", "PO845413"], "match": r"france insoumise",
    },
    {
        "id": "ECO", "short": "Écologistes", "name": "Écologistes",
        "desc": "Groupe Écologiste-NUPES puis Écologiste et Social",
        "groups": ["PO800526", "PO845439"], "match": r"[ée]cologiste",
    },
    {
        "id": "SOC", "short": "PS", "name": "Socialistes",
        "desc": "Groupe Socialistes et apparentés",
        "groups": ["PO800496", "PO830170", "PO845419"], "match": r"socialistes",
    },
    {
        "id": "LIOT", "short": "LIOT", "name": "LIOT",
        "desc": "Libertés, Indépendants, Outre-mer et Territoires (centristes, régionalistes, ultramarins)",
        "groups": ["PO800532", "PO845485"], "match": r"libert[ée]s,? ind[ée]pendants",
    },
    {
        "id": "DEM", "short": "MoDem", "name": "MoDem",
        "desc": "Groupe Démocrate (MoDem et Indépendants) puis Les Démocrates",
        "groups": ["PO800484", "PO845454"], "match": r"^(les )?d[ée]mocrates?\b",
    },
    {
        "id": "REN", "short": "Renaissance", "name": "Renaissance",
        "desc": "Parti d'Emmanuel Macron : groupe Renaissance (2022-2024) puis Ensemble pour la République (EPR)",
        "groups": ["PO800538", "PO845407"], "match": r"renaissance|ensemble pour la r[ée]publique",
    },
    {
        "id": "HOR", "short": "Horizons", "name": "Horizons",
        "desc": "Parti d'Édouard Philippe : Horizons et apparentés puis Horizons & Indépendants",
        "groups": ["PO800514", "PO845470"], "match": r"horizons",
    },
    {
        "id": "LR", "short": "LR", "name": "Les Républicains",
        "desc": "Groupe Les Républicains (2022-2024) puis Droite Républicaine",
        "groups": ["PO800508", "PO845425"], "match": r"les r[ée]publicains|droite r[ée]publicaine",
    },
    {
        "id": "UDR", "short": "UDR", "name": "UDR (Ciotti)",
        "desc": "Union des droites pour la République, groupe d'Éric Ciotti allié au RN (depuis 2024)",
        "groups": ["PO845520", "PO847173", "PO872880"], "match": r"union des droites|^udr$|^[àa] droite",
    },
    {
        "id": "RN", "short": "RN", "name": "Rassemblement national",
        "desc": "Groupe Rassemblement National",
        "groups": ["PO800520", "PO845401"], "match": r"rassemblement national",
    },
    {
        "id": "NI", "short": "Non-inscrits", "name": "Non-inscrits",
        "desc": "Députés n'appartenant à aucun groupe (pas de position collective)",
        "groups": ["PO793087", "PO840056"], "match": r"non inscrit",
    },
]

# Familles qui ont une position collective (les non-inscrits n'en ont pas).
POSITION_FAMILIES = [f["id"] for f in FAMILIES if f["id"] != "NI"]

# ---------------------------------------------------------------------------
# Types de scrutin (déduits de l'intitulé officiel).
# ---------------------------------------------------------------------------
KINDS = [
    ("ensemble", "Vote sur l'ensemble d'un texte"),
    ("partie", "Vote sur une partie d'un budget"),
    ("censure", "Motion de censure"),
    ("confiance", "Vote de confiance"),
    ("declaration", "Déclaration du Gouvernement"),
    ("motion", "Motion de procédure (rejet, renvoi…)"),
    ("article", "Vote sur un article"),
    ("amendement", "Amendement"),
    ("credits", "Crédits budgétaires"),
    ("resolution", "Proposition de résolution"),
    ("procedure", "Vote de procédure"),
    ("autre", "Autre"),
]

# ---------------------------------------------------------------------------
# Thèmes. Règles appliquées dans l'ordre sur le titre du dossier législatif
# (à défaut sur le nom du texte extrait de l'intitulé du scrutin). Première règle
# qui correspond = thème retenu. À défaut : thème de la commission saisie au fond.
# Les motifs sont des expressions régulières appliquées à un texte en minuscules
# et sans accents.
# ---------------------------------------------------------------------------
THEMES = [
    ("budget", "Budget & impôts"),
    ("social", "Retraites & protection sociale"),
    ("sante", "Santé"),
    ("travail", "Travail & emploi"),
    ("immigration", "Immigration"),
    ("securite", "Sécurité & justice"),
    ("ecologie", "Environnement, énergie & transports"),
    ("agriculture", "Agriculture & alimentation"),
    ("logement", "Logement & territoires"),
    ("outremer", "Outre-mer"),
    ("economie", "Économie & entreprises"),
    ("education", "Éducation, culture & sport"),
    ("societe", "Société & droits"),
    ("institutions", "Institutions & vie démocratique"),
    ("international", "Défense & international"),
    ("autre", "Autres"),
]

# Exceptions examinées avant les règles générales (cas ambigus repérés à la relecture).
THEME_OVERRIDES = [
    ("ecologie", [r"surete nucleaire", r"radioprotection", r"risque incendie", r"fonds marins"]),
    ("economie", [r"adaptation au droit de l.union europeenne", r"nationalisation", r"arcelor"]),
    ("securite", [r"ministere de l.interieur"]),
    ("societe", [r"proteger les (mineurs|enfants)", r"protection des (mineurs|enfants)"]),
    ("education", [r"jeux olympiques"]),
    ("agriculture", [r"\bvignes?\b"]),
    ("institutions", [r"grand debat national", r"mode de scrutin", r"fonctions electives", r"corse autonome", r"autonomie de la corse"]),
    ("international", [r"ukrain", r"franco-ukrainien"]),
    ("logement", [r"occupation illicite", r"\bsquat"]),
    ("education", [r"accompagnants? d.eleves"]),
    ("sante", [r"chemsex"]),
]

THEME_RULES = THEME_OVERRIDES + [
    ("immigration", [
        r"immigration", r"\basile\b", r"etrangers?\b", r"nationalite", r"retention administrative",
        r"titres? de sejour", r"\boqtf\b", r"regroupement familial", r"aide medicale de l.etat",
        r"franco-algerien", r"schengen", r"migrants?\b", r"droit du sol",
    ]),
    ("social", [
        r"financement de la securite sociale", r"financement rectificative de la securite sociale",
        r"retraites?\b", r"assurance chomage", r"\bchomage\b", r"allocations?\b", r"\brsa\b",
        r"revenu de solidarite", r"pauvrete", r"precarite", r"handicap", r"autonomie", r"grand age",
        r"dependance", r"aidants?\b", r"minima sociaux", r"protection sociale", r"fraudes? sociales?",
        r"prestations? sociales?", r"securite sociale",
    ]),
    ("budget", [
        r"loi de finances", r"finances rectificative", r"finances publiques", r"fin de gestion",
        r"resultats de la gestion", r"approbation des comptes", r"reglement du budget", r"loi speciale",
        r"credits de la mission", r"fiscal", r"\bimpots?\b", r"\btaxes?\b", r"taxation", r"dette publique",
        r"\bbudget",
    ]),
    ("societe", [
        r"fin de vie", r"aide a mourir", r"interruption volontaire de grossesse", r"\bivg\b",
        r"egalite (entre les femmes|femmes|salariale|reelle)", r"violences sexuelles", r"violences sexistes",
        r"violences faites aux femmes", r"violences conjugales", r"violences intrafamiliales", r"inceste",
        r"discrimination", r"laicite", r"separatisme", r"\bvoile\b", r"mariage", r"\bpma\b", r"\bgpa\b",
        r"filiation", r"adoption", r"protection de l.enfance", r"\benfan(ts|ce)\b", r"famille",
        r"animaux", r"\banimal", r"corrida", r"cannabis", r"consentement", r"homophob", r"racisme",
        r"antisemitisme", r"genocide", r"esclavage", r"memoire", r"\bculte", r"droits? des femmes",
    ]),
    ("sante", [
        r"\bsante\b", r"\bsoins?\b", r"medic", r"hopita", r"hospital", r"infirmi", r"pharmac",
        r"psychiatr", r"sanitaire", r"\btabac", r"alcool", r"cancer", r"maladie", r"vaccin", r"covid",
        r"deserts? medicaux", r"medecin", r"palliatif",
    ]),
    ("travail", [
        r"travail", r"\bemploi", r"salari", r"salaire", r"\bsmic\b", r"plein emploi", r"partage de la valeur",
        r"apprentissage", r"1er mai", r"dialogue social", r"conges?\b", r"pouvoir d.achat", r"france travail",
        r"syndica",
    ]),
    ("securite", [
        r"securite", r"police", r"gendarm", r"justice", r"judiciaire", r"penal", r"\bpeines?\b", r"prison",
        r"penitentiaire", r"terroris", r"attentat", r"narcotrafic", r"stupefiant", r"drogue", r"delinquan",
        r"criminalite", r"victimes", r"violences", r"legitime defense", r"forces de l.ordre",
        r"renseignement", r"\bsquat", r"occupation illicite", r"\bvols?\b", r"surete", r"justice des mineurs",
        r"cybersecurite", r"\barmes\b", r"etat civil", r"magistrat",
    ]),
    ("agriculture", [
        r"agricult", r"agricole", r"alimentation", r"alimentaire", r"egalim", r"\bpeche", r"elevage",
        r"eleveur", r"denrees", r"\bforets?\b", r"forestier", r"sylvic", r"viticul", r"\bvins?\b", r"\bloup",
    ]),
    ("ecologie", [
        r"energ", r"nucleaire", r"renouvelable", r"climat", r"environnement", r"ecolog", r"biodiversite",
        r"\beau\b", r"\beaux\b", r"pollution", r"carbone", r"electricite", r"transition", r"pesticide",
        r"glyphosate", r"neonicotino", r"plastique", r"dechets", r"artificialisation", r"littoral",
        r"montagne", r"transports?\b", r"mobilite", r"ferroviaire", r"\bsncf\b", r"aerien", r"routier",
        r"automobile", r"vehicule", r"\bvelo", r"industrie verte", r"hydroelectri", r"eolien", r"photovolta",
        r"\bpfas\b", r"polluants?",
    ]),
    ("outremer", [
        r"outre-mer", r"ultramarin", r"mayotte", r"guadeloupe", r"martinique", r"guyane", r"la reunion",
        r"nouvelle-caledonie", r"polynesie", r"wallis", r"saint-pierre-et-miquelon", r"saint-martin",
        r"saint-barthelemy", r"\bkanak",
    ]),
    ("logement", [
        r"logement", r"locati", r"\bloyers?\b", r"\bhlm\b", r"urbanisme", r"copropriet", r"meubles de tourisme",
        r"habitat", r"batiment", r"\bterritoir", r"collectivites", r"\bcommun(e|es|al|ale|aux)\b",
        r"ruralite", r"\bruraux\b", r"\brurale?s?\b", r"decentralisation", r"departement", r"\bregions?\b",
        r"elus? locaux", r"\bmaires?\b", r"\bcorse\b", r"amenagement", r"intercommunal",
    ]),
    ("education", [
        r"education", r"\becoles?\b", r"enseignement", r"scolaire", r"\beleves?\b", r"universit", r"etudiant",
        r"recherche", r"\bcultur", r"audiovisuel", r"\bpresse\b", r"medias?\b", r"\bsport", r"olympique",
        r"jeunesse", r"patrimoine", r"\blangues?\b", r"musee", r"cinema", r"\blivres?\b", r"architecture",
    ]),
    ("economie", [
        r"entreprise", r"econom", r"industri", r"commerc", r"simplification", r"numerique", r"internet",
        r"reseaux sociaux", r"plateforme", r"consommat", r"banque", r"bancaire", r"assurance", r"concurrence",
        r"\bpme\b", r"artisan", r"tourisme", r"souverainete", r"attractivite", r"investissement", r"epargne",
        r"financ", r"monnaie", r"\bprix\b", r"inflation", r"intelligence artificielle", r"donnees", r"telecom",
        r"postal", r"la poste", r"cryptoactif", r"\bactifs\b",
    ]),
    ("international", [
        r"defense", r"militaire", r"\barmees?\b", r"ukraine", r"russie", r"europe", r"accords?\b", r"convention",
        r"\btraite\b", r"ratification", r"approbation", r"israel", r"palestin", r"\bgaza\b", r"liban", r"\biran",
        r"armenie", r"azerbaidjan", r"\bchine\b", r"\botan\b", r"mercosur", r"international", r"diplomat",
        r"cooperation", r"veterans", r"anciens combattants", r"\bhaiti\b", r"afrique", r"algerie",
    ]),
    ("institutions", [
        r"constitution", r"election", r"electora", r"mode de scrutin", r"reglement de l.assemblee",
        r"commission d.enquete", r"parlement", r"referendum", r"\bmandats?\b", r"proportionnelle",
        r"vie publique", r"transparence", r"lobby", r"deontologie", r"fonction publique", r"administration",
        r"gouvernement", r"motion de censure", r"politique generale", r"democrat", r"\betat\b", r"elus?\b",
        r"president de la republique",
    ]),
]

# Commission saisie au fond → thème par défaut (si aucune règle ne s'applique).
COMMISSION_THEME = {
    "PO59048": "budget",          # Finances
    "PO420120": "social",         # Affaires sociales
    "PO59051": "institutions",    # Lois
    "PO419604": "education",      # Affaires culturelles et éducation
    "PO419610": "economie",       # Affaires économiques
    "PO419865": "ecologie",       # Développement durable
    "PO59046": "international",   # Défense
    "PO59047": "international",   # Affaires étrangères
}

COMMISSION_SHORT = {
    "PO59048": "Finances",
    "PO420120": "Affaires sociales",
    "PO59051": "Lois",
    "PO419604": "Affaires culturelles et éducation",
    "PO419610": "Affaires économiques",
    "PO419865": "Développement durable",
    "PO59046": "Défense",
    "PO59047": "Affaires étrangères",
}
