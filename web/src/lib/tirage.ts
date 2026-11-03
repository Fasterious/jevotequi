/* Quiz : tirage des questions par blocs et solidité du classement.
   Fonctions pures, sans dépendance ni accès au navigateur : elles sont testées telles quelles
   par tests/quiz.test.mjs (node --test). Méthode : METHODOLOGIE.md § 14. */

/** Réponse de la personne : pour, contre, ou question passée. */
export type Answer = "P" | "C" | "S";

/** Ce que le tirage et le calcul ont besoin de savoir d'une question. */
export interface QuestionInfo {
  id: string;
  theme: string;
  /** Position de chaque groupe au scrutin : P pour, C contre, A abstention, = partagé, - absent. */
  pos: string;
  /** Sens inverse : le scrutin portait sur la suppression de la mesure décrite. */
  inv?: boolean;
  retired?: boolean;
}

/** Nombre de questions par bloc : on commence par un bloc, puis on affine bloc par bloc. */
export const BLOCK_SIZE = 10;
/** Nombre de rééchantillonnages des réponses pour mesurer la solidité du classement. */
export const DRAWS = 1000;
/** Paliers du profil : nombre de réponses (pour ou contre) à partir duquel chacun peut être atteint.
    « Solide » demande en plus une solidité d'au moins SOLID_PERCENT. 25 réponses : c'est à partir de
    là que le seuil tient sa promesse dans les simulations (METHODOLOGIE § 14, tests/quiz-simulation.mjs). */
export const STAGE_MIN = { esquisse: 10, affine: 20, solide: 25 } as const;
/** Solidité (en %) à partir de laquelle un profil d'au moins 25 réponses est dit « solide ». */
export const SOLID_PERCENT = 90;

const EPS = 1e-9;

/* ------------------------------------------------------------------ hasard reproductible */

/** Générateur pseudo-aléatoire (mulberry32) : même graine, même suite de nombres dans [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Empreinte d'un texte (FNV-1a, 32 bits). */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Questions répondues (pour ou contre), triées par identifiant : l'ordre des réponses ne compte pas. */
function answeredIds(answers: Readonly<Record<string, Answer>>): string[] {
  return Object.keys(answers)
    .filter((id) => answers[id] === "P" || answers[id] === "C")
    .sort();
}

/** Graine dérivée des réponses : les mêmes réponses donnent toujours le même chiffre, y compris
    depuis un lien partagé. Les questions passées et l'ordre des réponses n'y changent rien. */
export function answersSeed(answers: Readonly<Record<string, Answer>>): number {
  return hash32(
    answeredIds(answers)
      .map((id) => `${id}=${answers[id]}`)
      .join(";"),
  );
}

/* ------------------------------------------------------------------ points */

/** Position d'un groupe vue depuis la question (« P » = pour la mesure décrite). */
export function viewedPos(q: Pick<QuestionInfo, "pos" | "inv">, i: number): string {
  const c = q.pos[i] ?? "-";
  if (!q.inv) return c;
  return c === "P" ? "C" : c === "C" ? "P" : c;
}

/** Points d'un groupe pour une réponse : 1 s'il a pris la même position, ½ s'il s'est abstenu,
    0 s'il a voté l'inverse ; null s'il était partagé ou absent (question non comptée pour lui). */
export function points(p: string, a: "P" | "C"): number | null {
  if (p === "P" || p === "C") return p === a ? 1 : 0;
  if (p === "A") return 0.5;
  return null;
}

/* ------------------------------------------------------------------ tirage */

/** Pouvoir de départage d'une question, entre 0 et 1. Pour chaque paire de groupes, la réponse crée
    entre eux un écart de points (même barème que le profil) : 1 entre un groupe pour et un groupe
    contre, ½ entre un groupe abstenu et un groupe qui a voté, 0 entre deux groupes du même avis.
    On additionne ces écarts sur toutes les paires et on rapporte la somme au maximum possible avec
    le même nombre de groupes (moitié pour, moitié contre). Le sens de la réponse n'y change rien.
    Exemples, 10 groupes : 5 pour et 5 contre → 1 ; 8 pour et 2 contre → 0,64 ; 9 pour et 1 contre → 0,36. */
export function discrimination(pos: string): number {
  let p = 0,
    c = 0,
    a = 0;
  for (const ch of pos) {
    if (ch === "P") p++;
    else if (ch === "C") c++;
    else if (ch === "A") a++;
  }
  const m = p + c + a;
  const max = Math.floor((m * m) / 4);
  return max ? (p * c + (a * (p + c)) / 2) / max : 0;
}

/** Poids d'une question au tirage : son pouvoir de départage (avec un plancher, pour qu'aucune
    question ne soit impossible à tirer). */
export function drawWeight(q: Pick<QuestionInfo, "pos">): number {
  return Math.max(0.05, discrimination(q.pos));
}

/** Questions encore à poser : ni retirées, ni déjà posées, dans les thèmes choisis. */
export function available<Q extends QuestionInfo>(questions: readonly Q[], already: readonly string[], themes: readonly string[] | null): Q[] {
  const done = new Set(already);
  return questions.filter((q) => !q.retired && !done.has(q.id) && (!themes || themes.includes(q.theme)));
}

function weightedPick<Q extends QuestionInfo>(cands: readonly Q[], rnd: () => number): Q {
  const w = cands.map(drawWeight);
  let r = rnd() * w.reduce((s, x) => s + x, 0);
  for (let i = 0; i < cands.length - 1; i++) {
    r -= w[i];
    if (r < 0) return cands[i];
  }
  return cands[cands.length - 1];
}

/** Tire un bloc de `k` questions parmi celles qui restent, une à une :
    1. thème : d'abord ceux qui ne figurent pas encore dans le bloc (pas deux fois le même thème
       tant qu'il en reste d'autres), puis, à égalité, ceux dont la plus faible part des questions
       a déjà été posée (les thèmes s'épuisent au même rythme, chacun est couvert au plus tôt) ;
    2. question : au hasard parmi celles de ces thèmes, avec une probabilité proportionnelle à son
       pouvoir de départage (`discrimination`).
    Le tirage est sans remise : bloc après bloc, toutes les questions finissent par être posées.
    Rend les identifiants dans l'ordre du tirage. */
export function drawBlock<Q extends QuestionInfo>(
  questions: readonly Q[],
  already: readonly string[],
  k: number = BLOCK_SIZE,
  themes: readonly string[] | null = null,
  rnd: () => number = Math.random,
): string[] {
  const pool = available(questions, already, themes);
  const done = new Set(already);
  const total = new Map<string, number>();
  const asked = new Map<string, number>();
  for (const q of questions) {
    if (q.retired) continue;
    total.set(q.theme, (total.get(q.theme) ?? 0) + 1);
    if (done.has(q.id)) asked.set(q.theme, (asked.get(q.theme) ?? 0) + 1);
  }
  const inBlock = new Map<string, number>();
  const inB = (t: string) => inBlock.get(t) ?? 0;
  const covered = (t: string) => ((asked.get(t) ?? 0) + inB(t)) / (total.get(t) ?? 1);

  const out: string[] = [];
  while (out.length < k && pool.length) {
    let bestIn = Infinity,
      bestCov = Infinity;
    for (const q of pool) {
      const i = inB(q.theme),
        c = covered(q.theme);
      if (i < bestIn || (i === bestIn && c < bestCov - EPS)) {
        bestIn = i;
        bestCov = c;
      }
    }
    const cands = pool.filter((q) => inB(q.theme) === bestIn && Math.abs(covered(q.theme) - bestCov) <= EPS);
    const pick = weightedPick(cands, rnd);
    out.push(pick.id);
    pool.splice(pool.indexOf(pick), 1);
    inBlock.set(pick.theme, inB(pick.theme) + 1);
  }
  return out;
}

/* ------------------------------------------------------------------ solidité du classement */

/** Points de chaque groupe (colonnes) pour chaque question répondue (lignes, triées par identifiant). */
export function pointRows(questions: readonly QuestionInfo[], nGroups: number, answers: Readonly<Record<string, Answer>>): (number | null)[][] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return answeredIds(answers)
    .filter((id) => byId.has(id))
    .map((id) => {
      const q = byId.get(id)!;
      const a = answers[id] as "P" | "C";
      return Array.from({ length: nGroups }, (_, g) => points(viewedPos(q, g), a));
    });
}

/** Groupes en tête (plusieurs en cas d'égalité) : taux d'accord le plus élevé parmi les groupes
    comptés au moins une fois. */
export function topGroups(rows: readonly (readonly (number | null)[])[]): number[] {
  if (!rows.length) return [];
  const G = rows[0].length;
  const sum = new Float64Array(G),
    cnt = new Uint32Array(G);
  for (const r of rows)
    for (let g = 0; g < G; g++) {
      const v = r[g];
      if (v != null) {
        sum[g] += v;
        cnt[g]++;
      }
    }
  let best = -Infinity;
  for (let g = 0; g < G; g++) if (cnt[g] && sum[g] / cnt[g] > best) best = sum[g] / cnt[g];
  const top: number[] = [];
  for (let g = 0; g < G; g++) if (cnt[g] && sum[g] / cnt[g] >= best - EPS) top.push(g);
  return top;
}

export interface Solidity {
  /** Groupes en tête sur l'ensemble des réponses (indices ; plusieurs en cas d'égalité). */
  top: number[];
  /** Part des tirages où la tête du classement reste la même, entre 0 et 1 ; null sans réponse. */
  share: number | null;
  /** Nombre de réponses (pour ou contre) prises en compte. */
  n: number;
  draws: number;
}

/** Solidité du classement par rééchantillonnage (bootstrap) : `draws` fois, on tire au hasard, avec
    remise, autant de questions qu'il y a de réponses (certaines comptent deux fois, d'autres pas du
    tout) et on refait le classement. `share` est la part des tirages où le ou les groupes en tête
    restent en tête ; une égalité dans un tirage est partagée (1/k pour chacun des k ex aequo). */
export function leaderSolidity(rows: readonly (readonly (number | null)[])[], seed: number, draws: number = DRAWS): Solidity {
  const n = rows.length;
  const top = topGroups(rows);
  if (!n || !top.length || draws <= 0) return { top, share: null, n, draws: 0 };
  const G = rows[0].length;
  const inTop = new Uint8Array(G);
  for (const g of top) inTop[g] = 1;
  const rnd = seededRandom(seed);
  const sum = new Float64Array(G),
    cnt = new Uint32Array(G);
  let acc = 0;
  for (let b = 0; b < draws; b++) {
    sum.fill(0);
    cnt.fill(0);
    for (let j = 0; j < n; j++) {
      const r = rows[Math.floor(rnd() * n)];
      for (let g = 0; g < G; g++) {
        const v = r[g];
        if (v != null) {
          sum[g] += v;
          cnt[g]++;
        }
      }
    }
    let best = -Infinity;
    for (let g = 0; g < G; g++) if (cnt[g] && sum[g] / cnt[g] > best) best = sum[g] / cnt[g];
    let k = 0,
      hit = 0;
    for (let g = 0; g < G; g++)
      if (cnt[g] && sum[g] / cnt[g] >= best - EPS) {
        k++;
        hit += inTop[g];
      }
    if (k) acc += hit / k;
  }
  return { top, share: acc / draws, n, draws };
}

/** Solidité des réponses d'une personne, avec la graine dérivée de ses réponses. */
export function solidityOf(questions: readonly QuestionInfo[], nGroups: number, answers: Readonly<Record<string, Answer>>, draws: number = DRAWS): Solidity {
  return leaderSolidity(pointRows(questions, nGroups, answers), answersSeed(answers), draws);
}

/** Solidité en pourcentage entier, arrondie vers le bas : le chiffre affiché n'atteint jamais un
    seuil que la valeur exacte n'atteint pas. */
export function solidityPercent(share: number): number {
  return Math.floor(share * 100 + EPS);
}

/* ------------------------------------------------------------------ paliers */

/** Étapes du profil, présentées comme des étapes de précision (pas des récompenses). */
export type Stage = "esquisse" | "affine" | "solide";

/** Palier atteint avec `n` réponses (pour ou contre) et la solidité mesurée. « Solide » demande au
    moins 25 réponses : avec moins, le rééchantillonnage surestime la stabilité du classement (à 20
    réponses, un groupe en tête dans 90 % des tirages ne l'est plus après toutes les questions dans
    environ 15 % des profils simulés). Un palier peut redescendre si la solidité baisse. */
export function profileStage(n: number, share: number | null): Stage | null {
  if (n < STAGE_MIN.esquisse) return null;
  if (n < STAGE_MIN.affine) return "esquisse";
  return n >= STAGE_MIN.solide && share != null && solidityPercent(share) >= SOLID_PERCENT ? "solide" : "affine";
}
