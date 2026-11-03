#!/usr/bin/env node
"use strict";
/* Crée dans le dépôt des avis les étiquettes utilisées par le classement automatique
   (une seule fois, à l'activation ; relancer ne change rien).

     AVIS_GITHUB_TOKEN=… AVIS_REPO=proprietaire/depot node scripts/avis-etiquettes.cjs

   Le jeton n'est jamais affiché ni écrit sur disque. */
const { LABELS } = require("../api/_lib/avis.js");

async function main() {
  const token = process.env.AVIS_GITHUB_TOKEN;
  const repo = process.env.AVIS_REPO;
  if (!token || !repo) {
    console.error("Renseigner AVIS_GITHUB_TOKEN et AVIS_REPO.");
    process.exit(1);
  }
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "jevotequi-avis" };
  const existing = new Set();
  for (let page = 1; ; page++) {
    const r = await fetch(`https://api.github.com/repos/${repo}/labels?per_page=100&page=${page}`, { headers });
    if (!r.ok) throw new Error(`lecture des étiquettes impossible (${r.status})`);
    const list = await r.json();
    list.forEach((l) => existing.add(l.name));
    if (list.length < 100) break;
  }
  for (const l of LABELS) {
    if (existing.has(l.name)) {
      console.log(`déjà là : ${l.name}`);
      continue;
    }
    const r = await fetch(`https://api.github.com/repos/${repo}/labels`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(l) });
    console.log(r.ok ? `créée : ${l.name}` : `échec (${r.status}) : ${l.name}`);
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
