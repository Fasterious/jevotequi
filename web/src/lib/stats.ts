import type { Core } from "./data";

export const CODE = { P: 80, C: 67, A: 65, N: 78, DOT: 46, EQ: 61, DASH: 45 } as const;
export const isVote = (c: number) => c === 80 || c === 67 || c === 65;

export type KindPreset = "all" | "final" | "key" | "amendement" | "article" | "motion" | "censure";

export const KIND_PRESETS: { id: KindPreset; label: string; kinds: string[] | null; hint: string }[] = [
  { id: "all", label: "Tous les scrutins", kinds: null, hint: "Tous les scrutins publics : amendements, articles, votes finaux, motions." },
  {
    id: "final",
    label: "Votes finaux",
    kinds: ["ensemble"],
    hint: "Vote sur l'ensemble d'un texte : c'est le vote qui adopte ou rejette une loi.",
  },
  {
    id: "key",
    label: "Grands votes",
    kinds: ["ensemble", "partie", "censure", "confiance", "declaration"],
    hint: "Votes finaux, parties de budget, motions de censure, votes de confiance et déclarations du Gouvernement.",
  },
  { id: "amendement", label: "Amendements", kinds: ["amendement"], hint: "Votes sur des amendements et sous-amendements." },
  { id: "article", label: "Articles", kinds: ["article"], hint: "Votes sur un article d'un texte." },
  { id: "motion", label: "Motions de rejet", kinds: ["motion"], hint: "Motions de rejet préalable, de renvoi en commission ou référendaires." },
  { id: "censure", label: "Censure", kinds: ["censure"], hint: "Motions de censure : seul le vote « pour » existe ; ne pas la voter revient à soutenir le Gouvernement." },
];

export interface Scope {
  leg: 0 | 16 | 17;
  kind: KindPreset;
  contested: boolean;
  /** Indice de thème, −1 = tous. */
  theme: number;
  /** Identifiant de gouvernement, "" = tous. */
  gov: string;
}

export const DEFAULT_SCOPE: Scope = { leg: 0, kind: "all", contested: false, theme: -1, gov: "" };

export function selectIdx(core: Core, sc: Scope): Int32Array {
  const preset = KIND_PRESETS.find((p) => p.id === sc.kind)!;
  const kindSet = preset.kinds ? new Set(preset.kinds.map((k) => core.kindIds.indexOf(k))) : null;
  const gov = sc.gov ? core.meta.governments.find((g) => g.id === sc.gov) : undefined;
  const out: number[] = [];
  const { s } = core;
  for (let i = 0; i < core.N; i++) {
    if (sc.leg && s.leg[i] !== sc.leg) continue;
    if (kindSet && !kindSet.has(s.kind[i])) continue;
    if (sc.theme >= 0 && s.theme[i] !== sc.theme) continue;
    if (sc.contested && !core.contested[i]) continue;
    if (gov && (s.date[i] < gov.from || (gov.to && s.date[i] > gov.to))) continue;
    out.push(i);
  }
  return Int32Array.from(out);
}

export interface Agreement {
  same: number;
  opp: number;
  partial: number;
  total: number;
}
export const EMPTY: Agreement = { same: 0, opp: 0, partial: 0, total: 0 };

/** Compare deux vecteurs de positions sur les scrutins sélectionnés.
 *  Seuls comptent les scrutins où les deux ont voté pour, contre ou abstention. */
export function agree(a: Uint8Array, b: Uint8Array, idx: Int32Array | number[]): Agreement {
  let same = 0,
    opp = 0,
    partial = 0,
    total = 0;
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    const x = a[i],
      y = b[i];
    if (!isVote(x) || !isVote(y)) continue;
    total++;
    if (x === y) same++;
    else if (x === 65 || y === 65) partial++;
    else opp++;
  }
  return { same, opp, partial, total };
}

export const rate = (g: Agreement): number | null => (g.total ? g.same / g.total : null);

export function matrix(core: Core, idx: Int32Array, fams: string[]): Agreement[][] {
  const n = fams.length;
  const out: Agreement[][] = Array.from({ length: n }, () => Array(n).fill(EMPTY));
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const g = agree(core.famVec[fams[a]], core.famVec[fams[b]], idx);
      out[a][b] = g;
      out[b][a] = g;
    }
  }
  return out;
}

export function quarterOf(date: string): string {
  const m = +date.slice(5, 7);
  return `${date.slice(0, 4)}-T${Math.floor((m - 1) / 3) + 1}`;
}
export function quarterStart(key: string): string {
  const q = +key.slice(-1);
  return `${key.slice(0, 4)}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`;
}
export function quarterEnd(key: string): string {
  const q = +key.slice(-1);
  const y = +key.slice(0, 4);
  const endMonth = q * 3;
  const last = new Date(Date.UTC(y, endMonth, 0)).getUTCDate();
  return `${y}-${String(endMonth).padStart(2, "0")}-${last}`;
}

export function allQuarters(core: Core): string[] {
  const first = core.s.date[0];
  const last = core.s.date[core.N - 1];
  const out: string[] = [];
  let y = +first.slice(0, 4);
  let q = Math.floor((+first.slice(5, 7) - 1) / 3) + 1;
  const lastKey = quarterOf(last);
  for (;;) {
    const key = `${y}-T${q}`;
    out.push(key);
    if (key === lastKey) break;
    q++;
    if (q > 4) {
      q = 1;
      y++;
    }
  }
  return out;
}

export interface SeriesPoint {
  key: string;
  start: string;
  end: string;
  ag: Agreement;
}

export function series(core: Core, a: Uint8Array, b: Uint8Array, idx: Int32Array): SeriesPoint[] {
  const qs = allQuarters(core);
  const pos = new Map(qs.map((q, k) => [q, k]));
  const acc = qs.map(() => ({ same: 0, opp: 0, partial: 0, total: 0 }));
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    const x = a[i],
      y = b[i];
    if (!isVote(x) || !isVote(y)) continue;
    const g = acc[pos.get(quarterOf(core.s.date[i]))!];
    g.total++;
    if (x === y) g.same++;
    else if (x === 65 || y === 65) g.partial++;
    else g.opp++;
  }
  return qs.map((key, k) => ({ key, start: quarterStart(key), end: quarterEnd(key), ag: acc[k] }));
}

export function byField(core: Core, field: "theme" | "kind", a: Uint8Array, b: Uint8Array, idx: Int32Array): Agreement[] {
  const n = field === "theme" ? core.themeIds.length : core.kindIds.length;
  const acc = Array.from({ length: n }, () => ({ same: 0, opp: 0, partial: 0, total: 0 }));
  const col = core.s[field];
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    const x = a[i],
      y = b[i];
    if (!isVote(x) || !isVote(y)) continue;
    const g = acc[col[i]];
    g.total++;
    if (x === y) g.same++;
    else if (x === 65 || y === 65) g.partial++;
    else g.opp++;
  }
  return acc;
}

/** Position d'une famille à un scrutin donné (caractère). */
export function famPos(core: Core, fam: string, i: number): string {
  const k = core.posIndex[fam];
  return k === undefined ? "-" : core.s.pos[i][k];
}

export function isDeputyId(id: string) {
  return /^PA\d+$/.test(id);
}
