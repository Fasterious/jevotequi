"use strict";
/* Fonction serveur (Vercel) : reçoit un avis du formulaire et crée un ticket GitHub étiqueté.

   Configuration (réglages du projet Vercel, jamais dans le code ni dans la page) :
     AVIS_GITHUB_TOKEN  jeton GitHub limité au dépôt des avis, droit « Issues : lecture et écriture »
     AVIS_REPO          dépôt qui reçoit les avis, par exemple « proprietaire/jevotequi-avis »
     AVIS_PUBLIC        « 1 » si ce dépôt est public : la page affiche alors le lien du ticket
   Sans configuration, la fonction répond 503 et le formulaire propose de copier l'avis. */

const { validate, looksAutomated, categorize, buildIssue, makeRateLimiter, createIssue } = require("./_lib/avis.js");

const allow = makeRateLimiter();

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 20000) throw new Error("trop long");
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function handler(req, res, { env = process.env, fetchImpl, now = Date.now() } = {}) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { ok: false, raison: "méthode non permise" });
  }
  const token = env.AVIS_GITHUB_TOKEN;
  const repo = env.AVIS_REPO;
  if (!token || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return send(res, 503, { ok: false, raison: "réception des avis non configurée" });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { ok: false, raison: "corps invalide" });
  }
  // Envoi automatique probable : on répond comme si tout allait bien, sans rien créer.
  if (looksAutomated(body, now)) return send(res, 200, { ok: true });

  const v = validate(body);
  if (!v.ok) return send(res, 400, { ok: false, raison: v.raison });

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
  if (!allow(ip, now)) return send(res, 429, { ok: false, raison: "trop d'envois, réessayez dans quelques minutes" });

  const labels = categorize(v.avis);
  const { title, body: text } = buildIssue(v.avis, labels, new Date(now));
  try {
    const issue = await createIssue({ token, repo, title, body: text, labels, ...(fetchImpl ? { fetchImpl } : {}) });
    return send(res, 201, { ok: true, numero: issue.number, ...(env.AVIS_PUBLIC === "1" ? { url: issue.url } : {}), etiquettes: labels });
  } catch (e) {
    return send(res, 502, { ok: false, raison: "envoi vers le suivi impossible pour le moment" });
  }
}

module.exports = (req, res) => handler(req, res);
module.exports.handler = handler;
