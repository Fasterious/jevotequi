/* Simulation du quiz : reproduit les chiffres cités dans METHODOLOGIE.md § 14 (ce n'est pas un test).
     node tests/quiz-simulation.mjs [profils par modèle, 1000 par défaut]
   Des personnes fictives répondent aux 37 questions publiées, tirées bloc par bloc comme sur le site ;
   on regarde si le groupe en tête après 10, 15, 20… réponses l'est encore après toutes les questions,
   et ce que vaut le seuil de solidité de 90 %. Le module web/src/lib/tirage.ts est compilé par
   l'esbuild installé avec le site (cd web && npm ci). Graines fixes : mêmes chiffres à chaque fois. */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const ROOT = new URL("../", import.meta.url);
const esbuild = createRequire(new URL("web/package.json", ROOT))("esbuild");
const { code } = esbuild.transformSync(readFileSync(new URL("web/src/lib/tirage.ts", ROOT), "utf8"), { loader: "ts", format: "esm" });
const T = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const QUIZ = JSON.parse(readFileSync(new URL("web/public/data/quiz.json", ROOT), "utf8"));
const FAMS = QUIZ.families;
const G = FAMS.length;
const ACTIVE = QUIZ.questions.filter((q) => !q.retired);
const byId = new Map(ACTIVE.map((q) => [q.id, q]));
const NP = Number(process.argv[2]) || 1000;
const pct = (x) => `${Math.round(100 * x)} %`;

/** Tirage uniforme (même stratification par thème, sans pondération) : tous les poids égaux. */
const UNIFORM = QUIZ.questions.map((q) => ({ ...q, pos: "PC" }));

function fullOrder(questions, rnd) {
  let order = [];
  for (;;) {
    const b = T.drawBlock(questions, order, T.BLOCK_SIZE, null, rnd);
    if (!b.length) return order;
    order = order.concat(b);
  }
}

/* ------------------------------------------------------------------ 1. le tirage */
{
  const N = 20000;
  const rnd = T.seededRandom(2026);
  const seen = new Map(ACTIVE.map((q) => [q.id, 0]));
  const nThemes = new Set(ACTIVE.map((q) => q.theme)).size;
  let d = 0,
    common = 0,
    allThemes = 0,
    prev = null;
  for (let s = 0; s < N; s++) {
    const b1 = T.drawBlock(QUIZ.questions, [], T.BLOCK_SIZE, null, rnd);
    const b2 = T.drawBlock(QUIZ.questions, b1, T.BLOCK_SIZE, null, rnd);
    for (const id of b1) seen.set(id, seen.get(id) + 1);
    d += b1.reduce((x, id) => x + T.discrimination(byId.get(id).pos), 0) / b1.length;
    if (new Set([...b1, ...b2].map((id) => byId.get(id).theme)).size === nThemes) allThemes++;
    if (prev) common += b1.filter((id) => prev.has(id)).length;
    prev = new Set(b1);
  }
  const dAll = ACTIVE.reduce((x, q) => x + T.discrimination(q.pos), 0) / ACTIVE.length;
  const inc = [...seen.entries()].sort((a, b) => a[1] - b[1]);
  console.log("Tirage (20 000 premiers blocs)");
  console.log(`  pouvoir de départage moyen : ${dAll.toFixed(2)} pour l'ensemble des questions, ${(d / N).toFixed(2)} pour le premier bloc`);
  console.log(`  présence dans le premier bloc : de ${pct(inc[0][1] / N)} (${inc[0][0]}) à ${pct(inc.at(-1)[1] / N)} (${inc.at(-1)[0]})`);
  console.log(`  questions communes aux premiers blocs de deux personnes : ${(common / (N - 1)).toFixed(1)} sur ${T.BLOCK_SIZE}`);
  console.log(`  tous les thèmes couverts par les deux premiers blocs : ${pct(allThemes / N)}`);
}

/* ------------------------------------------------------------------ 2. personnes fictives */
const fp = (q, g) => T.viewedPos(q, g);
const flip = (a) => (a === "P" ? "C" : "P");
const MODELS = {
  "vote comme un groupe, 15 % d'écarts": (r) => {
    const g = Math.floor(r() * G);
    return (q) => {
      const p = fp(q, g);
      const a = p === "P" || p === "C" ? p : r() < 0.5 ? "P" : "C";
      return r() < 0.15 ? flip(a) : a;
    };
  },
  "vote comme un groupe, 30 % d'écarts": (r) => {
    const g = Math.floor(r() * G);
    return (q) => {
      const p = fp(q, g);
      const a = p === "P" || p === "C" ? p : r() < 0.5 ? "P" : "C";
      return r() < 0.3 ? flip(a) : a;
    };
  },
  "entre deux groupes voisins, 10 % d'écarts": (r) => {
    const g = Math.floor(r() * (G - 1));
    return (q) => {
      const p = fp(q, g + (r() < 0.5 ? 0 : 1));
      const a = p === "P" || p === "C" ? p : r() < 0.5 ? "P" : "C";
      return r() < 0.1 ? flip(a) : a;
    };
  },
  "au hasard": (r) => () => (r() < 0.5 ? "P" : "C"),
};
const STEPS = [10, 15, 20, 25, 30];
const pooled = Object.fromEntries(STEPS.map((n) => [n, { k: 0, ok: 0 }]));
const leadRandom = { 10: new Array(G).fill(0), 37: new Array(G).fill(0) };

console.log(`\nPersonnes fictives (${NP} par modèle) : le groupe en tête après n réponses l'est-il encore après les ${ACTIVE.length} questions ?`);
for (const [name, make] of Object.entries(MODELS)) {
  const r = T.seededRandom(31337);
  const right = { w: Object.fromEntries(STEPS.map((n) => [n, 0])), u: Object.fromEntries(STEPS.map((n) => [n, 0])) };
  const solid = Object.fromEntries(STEPS.map((n) => [n, 0]));
  for (let p = 0; p < NP; p++) {
    const vote = make(r);
    const answers = Object.fromEntries(ACTIVE.map((q) => [q.id, vote(q)]));
    const final = new Set(T.topGroups(T.pointRows(QUIZ.questions, G, answers)));
    if (name === "au hasard") for (const g of final) leadRandom[37][g] += 1 / final.size;
    for (const [kind, questions] of [["w", QUIZ.questions], ["u", UNIFORM]]) {
      const order = fullOrder(questions, r);
      for (const n of STEPS) {
        const sub = Object.fromEntries(order.slice(0, n).map((id) => [id, answers[id]]));
        const top = T.topGroups(T.pointRows(QUIZ.questions, G, sub));
        const ok = top.filter((g) => final.has(g)).length / top.length;
        right[kind][n] += ok;
        if (kind !== "w") continue;
        if (n === 10 && name === "au hasard") for (const g of top) leadRandom[10][g] += 1 / top.length;
        const s = T.solidityOf(QUIZ.questions, G, sub);
        if (T.solidityPercent(s.share) >= T.SOLID_PERCENT) {
          solid[n]++;
          pooled[n].k++;
          pooled[n].ok += ok;
        }
      }
    }
  }
  console.log(`  ${name}`);
  console.log(`    encore en tête, tirage pondéré : ${STEPS.map((n) => `${n} rép. ${pct(right.w[n] / NP)}`).join(" · ")}`);
  console.log(`    encore en tête, tirage uniforme : ${STEPS.map((n) => `${n} rép. ${pct(right.u[n] / NP)}`).join(" · ")}`);
  console.log(`    solidité d'au moins ${T.SOLID_PERCENT} % : ${STEPS.map((n) => `${n} rép. ${pct(solid[n] / NP)}`).join(" · ")}`);
}

console.log(`\nQuand la solidité atteint ${T.SOLID_PERCENT} %, le groupe en tête l'est encore après toutes les questions (tous modèles) :`);
console.log("  " + STEPS.map((n) => `${n} rép. ${pct(pooled[n].ok / pooled[n].k)} (${pooled[n].k} profils)`).join(" · "));

console.log(`\nRéponses au hasard : part des cas où chaque groupe est en tête (${pct(1 / G)} si tous étaient à égalité de chances)`);
for (const n of [10, 37]) console.log(`  ${n} réponses : ${FAMS.map((f, g) => `${f} ${pct(leadRandom[n][g] / NP)}`).join(" · ")}`);
