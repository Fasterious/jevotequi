"use strict";
/* Tests de la réception des avis (node --test tests/) : règles de classement, protections,
   et fonction serveur face à un GitHub simulé (aucun appel réseau). */
const test = require("node:test");
const assert = require("node:assert/strict");
const lib = require("../api/_lib/avis.js");
const { handler } = require("../api/avis.js");

const NOW = Date.parse("2026-11-03T12:00:00Z");
const ok = (extra = {}) => ({ modules: ["mon-depute"], message: "Pouvoir chercher mon député par code postal.", profil: "Journaliste", origine: "projet-avis", version: "1.1.0", t0: NOW - 60000, site: "", ...extra });

function fakeRes() {
  return {
    statusCode: 0, headers: {}, body: "",
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(s) { this.body = s; },
    json() { return JSON.parse(this.body); },
  };
}
const req = (body, ip = "203.0.113.1", method = "POST") => ({ method, body, headers: { "x-forwarded-for": ip } });
const ENV = { AVIS_GITHUB_TOKEN: "jeton-de-test", AVIS_REPO: "projet/avis" };

test("validation : modules inconnus écartés, avis vide refusé, texte nettoyé", () => {
  const v = lib.validate({ modules: ["mon-depute", "pirate", "mon-depute"], message: "  bonjour \r\n ", profil: "Inconnu", origine: "quiz<script>" });
  assert.equal(v.ok, true);
  assert.deepEqual(v.avis.modules, ["mon-depute"]);
  assert.equal(v.avis.message, "bonjour");
  assert.equal(v.avis.profil, "");
  assert.equal(v.avis.origine, "quizscript");
  assert.equal(lib.validate({ modules: [], message: "   " }).ok, false);
  assert.equal(lib.validate({ message: "x".repeat(5000) }).avis.message.length, 2000);
});

test("envoi automatique : champ piège ou formulaire rempli trop vite", () => {
  assert.equal(lib.looksAutomated({ site: "http://spam", t0: NOW - 60000 }, NOW), true);
  assert.equal(lib.looksAutomated({ t0: NOW - 500 }, NOW), true);
  assert.equal(lib.looksAutomated({}, NOW), true);
  assert.equal(lib.looksAutomated({ t0: NOW - 60000 }, NOW), false);
});

test("classement : modules, mots-clés, sinon « remarques »", () => {
  assert.deepEqual(lib.categorize({ modules: ["mon-depute", "autre"], message: "" }), ["avis", "module : mon député"]);
  assert.ok(lib.categorize({ modules: [], message: "Le scrutin n° 3985 me semble faux" }).includes("type : erreur de données"));
  assert.ok(lib.categorize({ modules: [], message: "La page ne charge pas sur mon téléphone" }).includes("type : problème d'affichage"));
  assert.ok(lib.categorize({ modules: [], message: "Il faudrait ajouter les sénateurs" }).includes("type : idée"));
  assert.deepEqual(lib.categorize({ modules: [], message: "Merci pour ce travail." }), ["avis", "remarques"]);
  assert.deepEqual(lib.categorize({ modules: ["autre"], message: "" }), ["avis", "remarques"]);
  const known = new Set(lib.LABELS.map((l) => l.name));
  for (const m of Object.keys(lib.MODULES)) for (const l of lib.categorize({ modules: [m], message: "erreur bug idée" })) assert.ok(known.has(l), l);
});

test("ticket : titre lisible, message cité, mentions neutralisées, rien d'identifiant", () => {
  const avis = lib.validate(ok({ message: "Merci @quelquun, voir #12\nDeuxième ligne" })).avis;
  const { title, body } = lib.buildIssue(avis, lib.categorize(avis), new Date(NOW));
  assert.match(title, /^Avis : Retrouver les votes de mon député — Merci @​quelquun/);
  assert.match(body, /> Merci @​quelquun, voir #​12\n> Deuxième ligne/);
  assert.match(body, /\*\*Profil\*\* : Journaliste/);
  assert.doesNotMatch(body, /203\.0\.113/);
});

test("limite d'envois par adresse", () => {
  const allow = lib.makeRateLimiter({ perIp: 2, windowMs: 1000, global: 10 });
  assert.equal(allow("a", 0), true);
  assert.equal(allow("a", 10), true);
  assert.equal(allow("a", 20), false);
  assert.equal(allow("b", 20), true);
  assert.equal(allow("a", 2000), true);
});

test("fonction : méthode, configuration absente", async () => {
  let res = fakeRes();
  await handler(req({}, "198.51.100.1", "GET"), res, { env: ENV, now: NOW });
  assert.equal(res.statusCode, 405);
  res = fakeRes();
  await handler(req(ok(), "198.51.100.2"), res, { env: {}, now: NOW });
  assert.equal(res.statusCode, 503);
});

test("fonction : un robot ne crée rien", async () => {
  let called = false;
  const res = fakeRes();
  await handler(req(ok({ site: "rempli" }), "198.51.100.3"), res, { env: ENV, now: NOW, fetchImpl: async () => { called = true; } });
  assert.equal(res.statusCode, 200);
  assert.equal(called, false);
});

test("fonction : ticket créé avec ses étiquettes, lien seulement si le dépôt est public", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 201, json: async () => ({ number: 42, html_url: "https://github.com/projet/avis/issues/42" }) };
  };
  let res = fakeRes();
  await handler(req(ok(), "198.51.100.4"), res, { env: ENV, now: NOW, fetchImpl });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.json(), { ok: true, numero: 42, etiquettes: ["avis", "module : mon député", "type : idée"] });
  assert.equal(calls[0].url, "https://api.github.com/repos/projet/avis/issues");
  assert.equal(calls[0].init.headers.Authorization, "Bearer jeton-de-test");
  const sent = JSON.parse(calls[0].init.body);
  assert.deepEqual(sent.labels, ["avis", "module : mon député", "type : idée"]);
  res = fakeRes();
  await handler(req(ok(), "198.51.100.5"), res, { env: { ...ENV, AVIS_PUBLIC: "1" }, now: NOW, fetchImpl });
  assert.equal(res.json().url, "https://github.com/projet/avis/issues/42");
  assert.ok(!res.body.includes("jeton-de-test"));
});

test("fonction : GitHub indisponible → 502 sans fuite du jeton", async () => {
  const res = fakeRes();
  await handler(req(ok(), "198.51.100.6"), res, { env: ENV, now: NOW, fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) }) });
  assert.equal(res.statusCode, 502);
  assert.ok(!res.body.includes("jeton"));
});
