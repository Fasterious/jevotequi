import { getJSON } from "./data";

/* Quiz « Et toi, tu aurais voté quoi ? » : données, tirage, calcul du profil, partage.
   Les positions des groupes viennent des votes nominatifs (pipeline, étape 6) ; ce module
   ne fait que comparer les réponses de la personne à ces positions. */

export interface QuizQuestion {
  id: string;
  uid: string;
  leg: number;
  num: number;
  date: string;
  theme: string;
  kind: string;
  q: string;
  ctx: string;
  /** Sens inverse : le scrutin porte sur un amendement de suppression de la mesure. */
  inv: boolean;
  res: "adopté" | "rejeté";
  tot: [number, number, number];
  /** Position de chaque famille au scrutin (ordre de `families`), telle que publiée. */
  pos: string;
  /** Décomptes par famille : pour, contre, abstention, membres. */
  n: Record<string, [number, number, number, number]>;
  author: string | null;
  title: string;
  texte: string;
  note: string;
  statut: string;
  retired?: boolean;
}

export interface QuizData {
  version: string;
  methodVersion: string;
  families: string[];
  questions: QuizQuestion[];
  stats: {
    n: number;
    themes: Record<string, number>;
    adopted: number;
    inverse: number;
    legislatures: Record<string, number>;
    balance: Record<string, { pour: number; contre: number; abstention: number; n: number; part_pour: number | null }>;
  };
}

export type Answer = "P" | "C" | "S";

let quizPromise: Promise<QuizData> | null = null;
export function loadQuiz(): Promise<QuizData> {
  if (!quizPromise) {
    quizPromise = getJSON<QuizData>("quiz.json");
    quizPromise.catch(() => (quizPromise = null));
  }
  return quizPromise;
}

/** Position d'une famille vue depuis la question (« P » = pour la mesure décrite). */
export function famPos(q: QuizQuestion, i: number): string {
  const c = q.pos[i];
  if (!q.inv) return c;
  return c === "P" ? "C" : c === "C" ? "P" : c;
}

/** Décomptes vus depuis la question : pour la mesure, contre, abstention. */
export function famCounts(q: QuizQuestion, fam: string): [number, number, number] | null {
  const c = q.n[fam];
  if (!c) return null;
  return q.inv ? [c[1], c[0], c[2]] : [c[0], c[1], c[2]];
}

/** La mesure décrite par la question a-t-elle été retenue ? */
export function measureAdopted(q: QuizQuestion): boolean {
  return q.inv ? q.res !== "adopté" : q.res === "adopté";
}

/* ------------------------------------------------------------------ tirage */

function shuffle<T>(xs: T[], rnd: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Tirage stratifié : un tour de thèmes (les moins représentés d'abord), puis un autre…,
    jusqu'à `k` questions ; l'ordre final est mélangé. Aucune question déjà posée. */
export function drawNext(data: QuizData, already: string[], k: number, themes: string[] | null, rnd: () => number = Math.random): string[] {
  const done = new Set(already);
  const pool = data.questions.filter((q) => !q.retired && !done.has(q.id) && (!themes || themes.includes(q.theme)));
  const byTheme = new Map<string, QuizQuestion[]>();
  for (const q of shuffle(pool, rnd)) {
    if (!byTheme.has(q.theme)) byTheme.set(q.theme, []);
    byTheme.get(q.theme)!.push(q);
  }
  const seen: Record<string, number> = {};
  const byId = new Map(data.questions.map((q) => [q.id, q]));
  for (const id of already) {
    const t = byId.get(id)?.theme;
    if (t) seen[t] = (seen[t] ?? 0) + 1;
  }
  const order = shuffle([...byTheme.keys()], rnd).sort((a, b) => (seen[a] ?? 0) - (seen[b] ?? 0));
  const out: string[] = [];
  while (out.length < k && order.some((t) => byTheme.get(t)!.length)) {
    for (const t of order) {
      const list = byTheme.get(t)!;
      if (list.length && out.length < k) out.push(list.shift()!.id);
    }
  }
  return shuffle(out, rnd);
}

export function remaining(data: QuizData, already: string[], themes: string[] | null): number {
  const done = new Set(already);
  return data.questions.filter((q) => !q.retired && !done.has(q.id) && (!themes || themes.includes(q.theme))).length;
}

/* ------------------------------------------------------------------ profil */

export interface FamScore {
  fam: string;
  /** Points : 1 si même position, ½ si le groupe s'est abstenu, 0 sinon. */
  score: number;
  n: number;
  same: number;
  opp: number;
  abst: number;
  rate: number | null;
  lo: number | null;
  hi: number | null;
}

/** Intervalle de Wilson (90 %) : les questions étant tirées au hasard, il décrit l'incertitude
    due au tirage. Avec 20 réponses, il fait environ ± 17 points. */
export function wilson(p: number, n: number, z = 1.645): [number, number] {
  if (n === 0) return [0, 1];
  const z2 = z * z;
  const den = 1 + z2 / n;
  const c = (p + z2 / (2 * n)) / den;
  const h = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

export function scoreAll(data: QuizData, answers: Record<string, Answer>): FamScore[] {
  const byId = new Map(data.questions.map((q) => [q.id, q]));
  return data.families.map((fam, i) => {
    let score = 0,
      n = 0,
      same = 0,
      opp = 0,
      abst = 0;
    for (const [id, a] of Object.entries(answers)) {
      if (a === "S") continue;
      const q = byId.get(id);
      if (!q) continue;
      const p = famPos(q, i);
      if (p === "P" || p === "C") {
        n++;
        if (p === a) {
          score++;
          same++;
        } else opp++;
      } else if (p === "A") {
        n++;
        score += 0.5;
        abst++;
      }
    }
    const rate = n ? score / n : null;
    const [lo, hi] = rate == null ? [null, null] : wilson(rate, n);
    return { fam, score, n, same, opp, abst, rate, lo, hi };
  });
}

export function ranked(scores: FamScore[]): FamScore[] {
  return scores.filter((s) => s.n > 0).sort((a, b) => b.rate! - a.rate! || b.n - a.n || a.fam.localeCompare(b.fam));
}

/** Groupes dont l'intervalle chevauche celui du premier : impossibles à départager pour l'instant. */
export function tiedWithLeader(r: FamScore[]): FamScore[] {
  if (!r.length) return [];
  const lead = r[0];
  return r.slice(1).filter((s) => s.hi! >= lead.lo!);
}

/* ------------------------------------------------------------------ partage */

/** Code de partage : pour chaque réponse (hors « passer »), le rang de la question dans le
    fichier (2 caractères en base 36) suivi de p ou c. Le fichier des questions ne fait que
    s'allonger, ce qui garde les anciens liens valables. */
export function encodeAnswers(data: QuizData, order: string[], answers: Record<string, Answer>): string {
  const idx = new Map(data.questions.map((q, i) => [q.id, i]));
  return order
    .filter((id) => answers[id] === "P" || answers[id] === "C")
    .map((id) => idx.get(id)!.toString(36).padStart(2, "0") + (answers[id] === "P" ? "p" : "c"))
    .join("");
}

export function decodeAnswers(data: QuizData, code: string): { order: string[]; answers: Record<string, Answer> } | null {
  if (!code || !/^([0-9a-z]{2}[pc])+$/.test(code)) return null;
  const order: string[] = [];
  const answers: Record<string, Answer> = {};
  for (let i = 0; i < code.length; i += 3) {
    const q = data.questions[parseInt(code.slice(i, i + 2), 36)];
    if (!q || q.id in answers) return null;
    order.push(q.id);
    answers[q.id] = code[i + 2] === "p" ? "P" : "C";
  }
  return { order, answers };
}

/* ------------------------------------------------------------------ sauvegarde locale */

export interface SavedQuiz {
  version: string;
  order: string[];
  answers: Record<string, Answer>;
  target: number;
  themes: string[] | null;
}

const KEY = "qvq-quiz";

export function loadSaved(data: QuizData): SavedQuiz | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedQuiz;
    const ids = new Set(data.questions.map((q) => q.id));
    if (!Array.isArray(s.order) || s.order.some((id) => !ids.has(id))) return null;
    return s;
  } catch {
    return null;
  }
}

export function save(s: SavedQuiz | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : le quiz fonctionne sans reprise possible */
  }
}
