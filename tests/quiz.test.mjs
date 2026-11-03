/* Tests du quiz : tirage des questions par blocs et solidité du classement
   (node --test tests/quiz.test.mjs, ou node --test à la racine pour tous les tests JavaScript).
   Le module web/src/lib/tirage.ts est compilé à la volée par l'esbuild installé avec le site
   (cd web && npm ci) ; les tests portent sur les vraies questions publiées (quiz.json). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const ROOT = new URL("../", import.meta.url);
const requireWeb = createRequire(new URL("web/package.json", ROOT));
let esbuild;
try {
  esbuild = requireWeb("esbuild");
} catch {
  throw new Error("esbuild introuvable : installez d'abord les dépendances du site (cd web && npm ci).");
}
const source = readFileSync(new URL("web/src/lib/tirage.ts", ROOT), "utf8");
const { code } = esbuild.transformSync(source, { loader: "ts", format: "esm", target: "es2020" });
const T = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

const QUIZ = JSON.parse(readFileSync(new URL("web/public/data/quiz.json", ROOT), "utf8"));
const FAMS = QUIZ.families;
const ACTIVE = QUIZ.questions.filter((q) => !q.retired);
const byId = new Map(QUIZ.questions.map((q) => [q.id, q]));
const themeOf = (id) => byId.get(id).theme;

/** Parcours complet : blocs successifs jusqu'à épuisement des questions. */
function fullRun(seed, themes = null) {
  const rnd = T.seededRandom(seed);
  const blocks = [];
  let order = [];
  for (;;) {
    const b = T.drawBlock(QUIZ.questions, order, T.BLOCK_SIZE, themes, rnd);
    if (!b.length) break;
    blocks.push({ ids: b, themesLeft: new Set(T.available(QUIZ.questions, order, themes).map((q) => q.theme)).size });
    order = order.concat(b);
  }
  return { blocks, order };
}

/** Réponses d'une personne qui vote toujours comme le groupe `fam` (pour quand il s'est abstenu). */
function copyOf(fam) {
  const i = FAMS.indexOf(fam);
  const answers = {};
  for (const q of ACTIVE) {
    const p = T.viewedPos(q, i);
    answers[q.id] = p === "C" ? "C" : "P";
  }
  return answers;
}

/* ------------------------------------------------------------------ barème et départage */

test("points : 1 même position, ½ abstention, 0 inverse, rien si partagé ou absent", () => {
  assert.equal(T.points("P", "P"), 1);
  assert.equal(T.points("C", "P"), 0);
  assert.equal(T.points("A", "C"), 0.5);
  assert.equal(T.points("=", "P"), null);
  assert.equal(T.points("-", "C"), null);
  // sens inverse : voter contre l'amendement de suppression, c'est soutenir la mesure
  assert.equal(T.viewedPos({ pos: "PCA=-", inv: true }, 0), "C");
  assert.equal(T.viewedPos({ pos: "PCA=-", inv: true }, 1), "P");
  assert.equal(T.viewedPos({ pos: "PCA=-", inv: true }, 2), "A");
  assert.equal(T.viewedPos({ pos: "PCA=-", inv: false }, 0), "P");
});

test("pouvoir de départage : maximal pour un partage égal, symétrique, entre 0 et 1", () => {
  assert.equal(T.discrimination("PPPPPCCCCC"), 1);
  assert.equal(T.discrimination("PPPPPPPPCC"), 16 / 25);
  assert.equal(T.discrimination("PPPPPPPPPC"), 9 / 25);
  assert.equal(T.discrimination("PPPPPPPPPP"), 0);
  // une abstention compte pour un demi-écart avec chaque groupe qui a voté
  assert.equal(T.discrimination("PPPCA"), (3 + 4 / 2) / 6);
  // partagés et absents ne comptent pas
  assert.equal(T.discrimination("PPCC=-"), T.discrimination("PPCC"));
  const swap = (s) => s.replace(/[PC]/g, (c) => (c === "P" ? "C" : "P"));
  for (const q of ACTIVE) {
    const d = T.discrimination(q.pos);
    assert.ok(d > 0 && d <= 1, `${q.id} : ${d}`);
    assert.equal(T.discrimination(swap(q.pos)), d);
  }
});

/* ------------------------------------------------------------------ tirage par blocs */

test("blocs de 10 jusqu'à épuisement : chaque question une fois, aucune retirée", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { blocks, order } = fullRun(seed);
    assert.equal(new Set(order).size, order.length, "aucune question répétée");
    assert.deepEqual([...order].sort(), ACTIVE.map((q) => q.id).sort(), "toutes les questions actives, et elles seules");
    blocks.slice(0, -1).forEach((b) => assert.equal(b.ids.length, T.BLOCK_SIZE));
    assert.ok(blocks.at(-1).ids.length >= 1 && blocks.at(-1).ids.length <= T.BLOCK_SIZE);
  }
});

test("stratification : pas deux fois le même thème dans un bloc tant que d'autres thèmes restent", () => {
  const nThemes = new Set(ACTIVE.map((q) => q.theme)).size;
  for (let seed = 1; seed <= 300; seed++) {
    const { blocks } = fullRun(seed);
    for (const b of blocks) {
      const distinct = new Set(b.ids.map(themeOf)).size;
      assert.equal(distinct, Math.min(b.ids.length, b.themesLeft), `graine ${seed}`);
    }
    // tous les thèmes sont couverts dès les deux premiers blocs
    const first20 = new Set(blocks.slice(0, 2).flatMap((b) => b.ids).map(themeOf));
    assert.equal(first20.size, Math.min(nThemes, 2 * T.BLOCK_SIZE), `graine ${seed}`);
  }
});

test("thèmes choisis : le tirage s'y limite, puis s'arrête", () => {
  const themes = ["securite", "logement"];
  const { blocks, order } = fullRun(7, themes);
  const expected = ACTIVE.filter((q) => themes.includes(q.theme)).map((q) => q.id);
  assert.deepEqual([...order].sort(), [...expected].sort());
  assert.equal(blocks.length, 1);
  // deux thèmes : ils alternent tant que les deux ont des questions
  const seq = order.map(themeOf);
  const rounds = Math.min(...themes.map((t) => seq.filter((x) => x === t).length));
  for (let r = 0; r < rounds; r++) assert.notEqual(seq[2 * r], seq[2 * r + 1]);
  assert.deepEqual(T.drawBlock(QUIZ.questions, order, 10, themes, T.seededRandom(1)), []);
});

test("questions retirées et déjà posées : jamais tirées", () => {
  const qs = QUIZ.questions.map((q, i) => (i % 5 === 0 ? { ...q, retired: true } : q));
  const already = qs.filter((q, i) => i % 5 === 1).map((q) => q.id);
  const b = T.drawBlock(qs, already, 50, null, T.seededRandom(3));
  for (const id of b) {
    const q = qs.find((x) => x.id === id);
    assert.ok(!q.retired && !already.includes(id), id);
  }
  assert.equal(b.length, qs.filter((q) => !q.retired).length - already.length);
});

test("hasard : même graine, même tirage ; deux personnes n'ont pas les mêmes 10 premières questions", () => {
  assert.deepEqual(T.drawBlock(QUIZ.questions, [], 10, null, T.seededRandom(42)), T.drawBlock(QUIZ.questions, [], 10, null, T.seededRandom(42)));
  const firsts = new Set();
  let overlap = 0;
  for (let s = 1; s <= 400; s += 2) {
    const a = T.drawBlock(QUIZ.questions, [], 10, null, T.seededRandom(s));
    const b = new Set(T.drawBlock(QUIZ.questions, [], 10, null, T.seededRandom(s + 1)));
    firsts.add([...a].sort().join(","));
    overlap += a.filter((id) => b.has(id)).length;
  }
  assert.equal(firsts.size, 200, "200 premiers blocs tous différents");
  assert.ok(overlap / 200 < 5, `questions communes à deux personnes : ${overlap / 200} sur 10 en moyenne`);
});

test("pondération : les votes les plus disputés sortent plus souvent, toutes les questions restent possibles", () => {
  const N = 3000;
  const seen = new Map(ACTIVE.map((q) => [q.id, 0]));
  let dBlock = 0;
  for (let s = 1; s <= N; s++) {
    const b = T.drawBlock(QUIZ.questions, [], 10, null, T.seededRandom(1000 + s));
    for (const id of b) seen.set(id, seen.get(id) + 1);
    dBlock += b.reduce((x, id) => x + T.discrimination(byId.get(id).pos), 0) / b.length;
  }
  const dAll = ACTIVE.reduce((x, q) => x + T.discrimination(q.pos), 0) / ACTIVE.length;
  assert.ok(dBlock / N > dAll + 0.01, `départage moyen du premier bloc ${dBlock / N} > ensemble ${dAll}`);
  for (const [id, n] of seen) assert.ok(n / N > 0.05, `${id} figure dans le premier bloc ${(100 * n) / N} % des fois`);
  // à thème égal, la question la plus disputée sort plus souvent que la moins disputée
  const eco = ACTIVE.filter((q) => q.theme === "ecologie").sort((a, b) => T.discrimination(b.pos) - T.discrimination(a.pos));
  assert.ok(seen.get(eco[0].id) > seen.get(eco.at(-1).id));
});

/* ------------------------------------------------------------------ solidité */

test("solidité : graine dérivée des réponses, indépendante de l'ordre et des questions passées", () => {
  const a = { x: "P", y: "C", z: "S" };
  const b = { y: "C", x: "P" };
  assert.equal(T.answersSeed(a), T.answersSeed(b));
  assert.notEqual(T.answersSeed(a), T.answersSeed({ x: "C", y: "C" }));
  const answers = copyOf("ECO");
  const shuffled = Object.fromEntries(Object.entries(answers).reverse());
  assert.deepEqual(T.solidityOf(QUIZ.questions, FAMS.length, answers), T.solidityOf(QUIZ.questions, FAMS.length, shuffled));
});

test("solidité : cas simples", () => {
  assert.deepEqual(T.leaderSolidity([], 1), { top: [], share: null, n: 0, draws: 0 });
  // le groupe 0 est d'accord partout, le groupe 1 nulle part : il reste en tête dans tous les tirages
  const net = Array.from({ length: 12 }, () => [1, 0, 0.5]);
  assert.deepEqual(T.leaderSolidity(net, 9), { top: [0], share: 1, n: 12, draws: T.DRAWS });
  // deux groupes jumeaux : ils sont en tête ensemble, et le restent
  const twins = Array.from({ length: 12 }, (_, i) => [i % 3 ? 1 : 0, i % 3 ? 1 : 0, 0]);
  const s = T.leaderSolidity(twins, 9);
  assert.deepEqual(s.top, [0, 1]);
  assert.ok(s.share > 0.999, String(s.share));
  // deux groupes qui ne diffèrent que sur 3 questions sur 20 (2 pour le premier, 1 pour le second) :
  // le premier est en tête, mais la tête change souvent d'un tirage à l'autre
  const close = Array.from({ length: 20 }, (_, i) => [i === 0 || i === 1 ? 1 : i === 2 ? 0 : i % 2, i === 2 ? 1 : i < 2 ? 0 : i % 2, 0]);
  const c = T.leaderSolidity(close, 9);
  assert.deepEqual(c.top, [0]);
  assert.ok(c.share > 0.5 && c.share < 0.9, String(c.share));
  // plus de réponses dans le même rapport : le classement devient plus solide
  const close3 = [...close, ...close, ...close];
  assert.ok(T.leaderSolidity(close3, 9).share > c.share);
  // une égalité dans un tirage se partage : ici les deux groupes ne diffèrent que sur 1 question
  // sur 10 ; quand elle n'est pas tirée (≈ 35 % des tirages), ils sont ex aequo et le premier
  // n'en compte que la moitié (≈ 1 − 0,35 / 2)
  const one = [...Array.from({ length: 9 }, () => [1, 1]), [1, 0]];
  const o = T.leaderSolidity(one, 9);
  assert.deepEqual(o.top, [0]);
  assert.ok(o.share > 0.75 && o.share < 0.9, String(o.share));
  // un groupe sans aucune position n'est jamais en tête
  assert.deepEqual(T.topGroups([[null, 0], [null, 1]]), [1]);
});

test("solidité : même résultat à chaque calcul, et un résultat net sur de vraies réponses", () => {
  // groupes qui ne se sont jamais abstenus : une personne qui vote toujours comme eux leur ressemble à 100 %
  const never = FAMS.filter((f) => QUIZ.stats.balance[f]?.abstention === 0);
  assert.ok(never.length >= 2);
  for (const fam of never) {
    const answers = copyOf(fam);
    const s1 = T.solidityOf(QUIZ.questions, FAMS.length, answers);
    const s2 = T.solidityOf(QUIZ.questions, FAMS.length, answers);
    assert.deepEqual(s1, s2);
    assert.ok(s1.top.includes(FAMS.indexOf(fam)), `${fam} en tête de ses propres votes`);
    assert.ok(s1.share >= 0.9, `${fam} : ${s1.share}`);
  }
});

test("solidité : réponses au hasard → tête rarement solide", () => {
  const rnd = T.seededRandom(5);
  let solid = 0;
  for (let p = 0; p < 60; p++) {
    const answers = Object.fromEntries(ACTIVE.map((q) => [q.id, rnd() < 0.5 ? "P" : "C"]));
    const s = T.solidityOf(QUIZ.questions, FAMS.length, answers, 300);
    if (T.solidityPercent(s.share) >= T.SOLID_PERCENT) solid++;
  }
  assert.ok(solid <= 6, `${solid} profils solides sur 60 réponses au hasard`);
});

/* ------------------------------------------------------------------ paliers */

test("paliers : esquissé à 10 réponses, affiné à 20, solide à 25 réponses et 90 % des tirages", () => {
  assert.equal(T.profileStage(9, 1), null);
  assert.equal(T.profileStage(10, 1), "esquisse");
  assert.equal(T.profileStage(19, 1), "esquisse");
  assert.equal(T.profileStage(20, 1), "affine");
  assert.equal(T.profileStage(24, 0.99), "affine");
  assert.equal(T.profileStage(25, 0.899), "affine");
  assert.equal(T.profileStage(25, 0.9), "solide");
  assert.equal(T.profileStage(37, 0.95), "solide");
  assert.equal(T.profileStage(30, null), "affine");
  assert.equal(T.solidityPercent(0.8999), 89);
  assert.equal(T.solidityPercent(0.9), 90);
});
