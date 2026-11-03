// Produit, à côté de dist/index.html (page complète pour Vercel ou tout hébergeur
// statique), dist/artifact.html : la même page sans <!doctype>/<html>/<head>/<body>,
// format attendu par les Artifacts claude.ai (le squelette est ajouté à la publication).
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("dist/index.html", "utf8");
const head = html.match(/<head>([\s\S]*?)<\/head>/i)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/i)[1];
const keepHead = head
  .replace(/<meta charset[^>]*>\s*/i, "")
  .replace(/<meta name="viewport"[^>]*>\s*/i, "")
  .trim();
// <title> en tête de fichier (le titre n'est lu que dans les 8 premiers Ko).
const title = keepHead.match(/<title>[\s\S]*?<\/title>/i)[0];
const rest = keepHead.replace(title, "").trim();
const flag = "<script>window.__QVQ_ARTIFACT__ = true;</script>";
writeFileSync("dist/artifact.html", `${title}\n${rest}\n${flag}\n${body.trim()}\n`);
console.log("dist/artifact.html écrit", (readFileSync("dist/artifact.html").length / 1024).toFixed(0), "Ko");
