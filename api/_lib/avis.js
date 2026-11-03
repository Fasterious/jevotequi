"use strict";
/* Avis des visiteurs → tickets GitHub (« issues »), sans que le visiteur ait de compte GitHub.

   Le formulaire du site envoie l'avis à la fonction /api/avis ; c'est elle, avec le jeton du
   projet (variable d'environnement côté serveur, jamais dans la page), qui crée le ticket dans
   le dépôt choisi, avec des étiquettes qui le rangent au bon endroit.

   Règles de classement (simples et lisibles, donc vérifiables) :
   - chaque module coché devient une étiquette « module : … » ;
   - le message est classé par mots-clés : « type : erreur de données », « type : problème
     d'affichage », « type : idée » ;
   - un avis qu'aucune règle ne range reçoit l'étiquette « remarques » (à trier à la main).
   Rien d'identifiant n'est transmis : ni nom, ni adresse, ni adresse IP. */

const MODULES = {
  "programmes-votes": "Comparer les programmes aux votes passés",
  promesses: "Savoir quelles promesses ont été tenues",
  "mon-depute": "Retrouver les votes de mon député",
  candidats: "Comparer les candidats entre eux",
  "quiz-plus": "Plus de questions dans le quiz",
  explications: "Des explications simples sur chaque texte",
  autre: "Autre chose",
};

const MODULE_LABELS = {
  "programmes-votes": "module : programmes et votes",
  promesses: "module : promesses",
  "mon-depute": "module : mon député",
  candidats: "module : candidats",
  "quiz-plus": "module : quiz",
  explications: "module : explications",
};

const PROFILS = ["Électeur ou électrice", "Journaliste", "Enseignant, étudiant ou chercheur", "Élu ou collaborateur", "Autre"];

/** Toutes les étiquettes utilisées (nom, couleur, description) : créées par scripts/creer-etiquettes.mjs. */
const LABELS = [
  { name: "avis", color: "0e8a16", description: "Avis envoyé depuis le formulaire du site" },
  { name: "remarques", color: "bfd4f2", description: "Avis à trier : aucune règle ne l'a rangé" },
  { name: "type : erreur de données", color: "d73a4a", description: "Un chiffre, un vote ou un rattachement semble faux" },
  { name: "type : problème d'affichage", color: "e99695", description: "Bug, lenteur, affichage" },
  { name: "type : idée", color: "a2eeef", description: "Proposition d'amélioration" },
  ...Object.values(MODULE_LABELS).map((name) => ({ name, color: "fef2c0", description: "Module souhaité par le visiteur" })),
];

const KEYWORDS = [
  {
    label: "type : erreur de données",
    re: /\b(erreurs?|faux|fausses?|inexacte?s?|incorrecte?s?|incoh[ée]rente?s?|mauvais(e|es)? (chiffres?|votes?|groupes?|r[ée]sultats?)|ne correspond pas|scrutin\s*(n[°o]?\s*)?\d+)/i,
  },
  {
    label: "type : problème d'affichage",
    re: /\b(bugs?|bogues?|beugs?|plant[ée]?|ne (marche|fonctionne|charge|s'affiche)\s+(pas|plus)|affichage|illisible|trop lent|chargement|sur (mon )?(t[ée]l[ée]phone|mobile))/i,
  },
  {
    label: "type : idée",
    re: /\b(id[ée]es?|propose|proposition|suggestion|sugg[èe]re|ajouter|pourriez|serait (bien|utile|top|int[ée]ressant)|il manque|j'aimerais|il faudrait|pouvoir)\b/i,
  },
];

const MAX_MESSAGE = 2000;
const MIN_DELAY_MS = 2500; // un humain met plus de 2,5 s à remplir le formulaire

/** Vérifie et nettoie l'avis reçu. Renvoie {ok, avis} ou {ok: false, raison}. */
function validate(body) {
  if (!body || typeof body !== "object") return { ok: false, raison: "corps invalide" };
  const modules = Array.isArray(body.modules) ? [...new Set(body.modules.filter((m) => typeof m === "string" && m in MODULES))] : [];
  const message = typeof body.message === "string" ? body.message.replace(/\r\n?/g, "\n").trim().slice(0, MAX_MESSAGE) : "";
  const profil = PROFILS.includes(body.profil) ? body.profil : "";
  const origine = typeof body.origine === "string" ? body.origine.replace(/[^a-z0-9-]/gi, "").slice(0, 40) : "";
  const version = typeof body.version === "string" ? body.version.replace(/[^0-9.]/g, "").slice(0, 12) : "";
  if (!modules.length && !message) return { ok: false, raison: "avis vide" };
  return { ok: true, avis: { modules, message, profil, origine, version } };
}

/** Signes d'un envoi automatique : champ piège rempli ou formulaire rempli trop vite. */
function looksAutomated(body, now = Date.now()) {
  if (body && typeof body.site === "string" && body.site.trim()) return true;
  const t0 = Number(body && body.t0);
  return !Number.isFinite(t0) || now - t0 < MIN_DELAY_MS || now - t0 > 24 * 3600 * 1000;
}

/** Étiquettes du ticket : « avis », modules cochés, types repérés dans le message, sinon « remarques ». */
function categorize(avis) {
  const labels = ["avis"];
  for (const m of avis.modules) if (MODULE_LABELS[m]) labels.push(MODULE_LABELS[m]);
  for (const k of KEYWORDS) if (avis.message && k.re.test(avis.message)) labels.push(k.label);
  if (labels.length === 1) labels.push("remarques");
  return labels;
}

/** Empêche le texte d'un visiteur de notifier quelqu'un (@nom) ou de lier un autre ticket (#12). */
function neutralize(text) {
  return text.replace(/@(?=[A-Za-z0-9_-])/g, "@​").replace(/#(?=\d)/g, "#​");
}

function excerpt(text, n = 70) {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > n ? one.slice(0, n - 1).trimEnd() + "…" : one;
}

/** Titre et corps (Markdown) du ticket. */
function buildIssue(avis, labels, date = new Date()) {
  const first = avis.modules.find((m) => m !== "autre");
  const kind = first ? MODULES[first] : labels.find((l) => l.startsWith("type : "))?.slice(7) ?? "remarque";
  const title = `Avis : ${kind}${avis.message ? " — " + neutralize(excerpt(avis.message)) : ""}`;
  const quoted = avis.message
    ? neutralize(avis.message)
        .split("\n")
        .map((l) => "> " + l)
        .join("\n")
    : "_Pas de message._";
  const lines = [
    `**Ce qui serait utile** : ${avis.modules.length ? avis.modules.map((m) => MODULES[m]).join(" ; ") : "—"}`,
    `**Profil** : ${avis.profil || "non précisé"}`,
    `**Page d'origine** : ${avis.origine || "—"}`,
    "",
    quoted,
    "",
    "---",
    `Envoyé depuis le formulaire « Aidez-nous à améliorer cet outil » le ${date.toISOString().slice(0, 10)}` +
      (avis.version ? ` (version ${avis.version})` : "") +
      ". Aucune donnée identifiante (nom, adresse, adresse IP) n'est transmise. Étiquettes posées automatiquement : à corriger librement.",
  ];
  return { title: title.slice(0, 250), body: lines.join("\n") };
}

/** Limite par adresse (en mémoire, au mieux : une instance de fonction ne voit que ses propres appels). */
function makeRateLimiter({ perIp = 5, windowMs = 10 * 60 * 1000, global = 60 } = {}) {
  const hits = new Map();
  let all = [];
  return function allow(ip, now = Date.now()) {
    all = all.filter((t) => now - t < windowMs);
    const mine = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    if (mine.length >= perIp || all.length >= global) return false;
    mine.push(now);
    all.push(now);
    hits.set(ip, mine);
    return true;
  };
}

/** Crée le ticket. `fetchImpl` est remplaçable pour les tests. */
async function createIssue({ token, repo, title, body, labels, fetchImpl = fetch }) {
  const r = await fetchImpl(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "jevotequi-avis",
    },
    body: JSON.stringify({ title, body, labels }),
  });
  if (!r.ok) {
    const err = new Error(`GitHub a refusé le ticket (${r.status})`);
    err.status = r.status;
    throw err;
  }
  const j = await r.json();
  return { number: j.number, url: j.html_url };
}

module.exports = { MODULES, MODULE_LABELS, LABELS, PROFILS, validate, looksAutomated, categorize, neutralize, buildIssue, makeRateLimiter, createIssue };
