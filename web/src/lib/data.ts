import React from "react";
import type {
  Censure,
  Deputy,
  FamilyMeta,
  Meta,
  ScrutinCols,
  ScrutinDetail,
  TextCols,
} from "./types";

const BASE = "data/";

export async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`Impossible de charger ${path} (erreur ${r.status}).`);
  return (await r.json()) as T;
}

export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'")
    .toLowerCase();
}

export interface Core {
  meta: Meta;
  s: ScrutinCols;
  t: TextCols;
  N: number;
  famById: Record<string, FamilyMeta>;
  /** Familles ayant une position collective (ordre des caractères de `pos`). */
  posFams: string[];
  posIndex: Record<string, number>;
  kindIds: string[];
  themeIds: string[];
  /** « 17-3985 » → index global (ordre chronologique). */
  byKey: Map<string, number>;
  /** Pour chaque famille : code de position (P, C, A, =, -) par scrutin. */
  famVec: Record<string, Uint8Array>;
  /** 1 si au moins deux groupes ont pris des positions différentes. */
  contested: Uint8Array;
  /** Pour chaque législature : numéro de scrutin − 1 → index global. */
  legIdx: Record<number, Int32Array>;
  /** Titres repliés (sans accents) pour la recherche. */
  searchText: string[];
}

let corePromise: Promise<Core> | null = null;

export function loadCore(): Promise<Core> {
  if (!corePromise) {
    corePromise = (async () => {
      const [meta, s, t] = await Promise.all([
        getJSON<Meta>("meta.json"),
        getJSON<ScrutinCols>("scrutins.json"),
        getJSON<TextCols>("texts.json"),
      ]);
      const N = s.num.length;
      const famById: Record<string, FamilyMeta> = {};
      meta.families.forEach((f) => (famById[f.id] = f));
      const posFams = meta.positionFamilies;
      const posIndex: Record<string, number> = {};
      posFams.forEach((f, i) => (posIndex[f] = i));
      const famVec: Record<string, Uint8Array> = {};
      posFams.forEach((f) => (famVec[f] = new Uint8Array(N)));
      const contested = new Uint8Array(N);
      const byKey = new Map<string, number>();
      const legIdx: Record<number, Int32Array> = {};
      meta.legislatures.forEach((l) => (legIdx[l.num] = new Int32Array(l.n).fill(-1)));
      for (let i = 0; i < N; i++) {
        const p = s.pos[i];
        let first = 0;
        let diff = false;
        for (let k = 0; k < posFams.length; k++) {
          const c = p.charCodeAt(k);
          famVec[posFams[k]][i] = c;
          if (c === 80 || c === 67 || c === 65) {
            if (first === 0) first = c;
            else if (c !== first) diff = true;
          }
        }
        contested[i] = diff ? 1 : 0;
        byKey.set(`${s.leg[i]}-${s.num[i]}`, i);
        const li = legIdx[s.leg[i]];
        if (li) li[s.num[i] - 1] = i;
      }
      const searchText = s.title.map((ti, i) => fold(ti + " " + (s.text[i] >= 0 ? t.title[s.text[i]] : "")));
      return {
        meta,
        s,
        t,
        N,
        famById,
        posFams,
        posIndex,
        kindIds: meta.kinds.map((k) => k.id),
        themeIds: meta.themes.map((k) => k.id),
        byKey,
        famVec,
        contested,
        legIdx,
        searchText,
      };
    })();
    corePromise.catch(() => (corePromise = null));
  }
  return corePromise;
}

export interface DeputyIndex {
  list: Deputy[];
  byId: Map<string, Deputy>;
  /** Par législature, députés indexés par leur rang dans les fichiers de votes. */
  byLeg: Record<number, Deputy[]>;
}

let depPromise: Promise<DeputyIndex> | null = null;
export function loadDeputies(): Promise<DeputyIndex> {
  if (!depPromise) {
    depPromise = getJSON<Deputy[]>("deputes.json").then((list) => {
      const byId = new Map<string, Deputy>();
      const byLeg: Record<number, Deputy[]> = {};
      for (const d of list) {
        byId.set(d.id, d);
        for (const [leg, L] of Object.entries(d.legs)) {
          (byLeg[+leg] ||= [])[L.i] = d;
        }
      }
      return { list, byId, byLeg };
    });
    depPromise.catch(() => (depPromise = null));
  }
  return depPromise;
}

const detailCache = new Map<string, Promise<Record<string, ScrutinDetail>>>();
export function loadDetail(core: Core, leg: number, num: number): Promise<ScrutinDetail | undefined> {
  const L = core.meta.legislatures.find((l) => l.num === leg);
  if (!L) return Promise.resolve(undefined);
  const key = `${leg}-${Math.floor((num - 1) / L.chunk)}`;
  let p = detailCache.get(key);
  if (!p) {
    p = getJSON<Record<string, ScrutinDetail>>(`details/${key}.json`);
    p.catch(() => detailCache.delete(key));
    detailCache.set(key, p);
  }
  return p.then((d) => d[String(num)]);
}

const voteCache = new Map<string, Promise<{ ids: string[]; v: string[] }>>();
function loadVoteChunk(leg: number, k: number) {
  const key = `${leg}-${k}`;
  let p = voteCache.get(key);
  if (!p) {
    p = getJSON<{ ids: string[]; v: string[] }>(`votes/${key}.json`);
    p.catch(() => voteCache.delete(key));
    voteCache.set(key, p);
  }
  return p;
}

export async function loadVoteString(core: Core, leg: number, idx: number): Promise<string> {
  const L = core.meta.legislatures.find((l) => l.num === leg)!;
  const chunk = await loadVoteChunk(leg, Math.floor(idx / L.voteChunk));
  return chunk.v[idx % L.voteChunk];
}

/** Votes d'un député ramenés sur l'index global (« . » hors mandat). */
const vecCache = new Map<string, Promise<Uint8Array>>();
export function deputyVector(core: Core, dep: Deputy): Promise<Uint8Array> {
  let p = vecCache.get(dep.id);
  if (!p) {
    p = (async () => {
      const vec = new Uint8Array(core.N).fill(46);
      for (const [legStr, L] of Object.entries(dep.legs)) {
        const leg = +legStr;
        const str = await loadVoteString(core, leg, L.i);
        const map = core.legIdx[leg];
        for (let j = 0; j < str.length && j < map.length; j++) {
          if (map[j] >= 0) vec[map[j]] = str.charCodeAt(j);
        }
      }
      return vec;
    })();
    p.catch(() => vecCache.delete(dep.id));
    vecCache.set(dep.id, p);
  }
  return p;
}

/** Tous les vecteurs d'une législature (pour « les députés les plus proches »). */
export async function legVectors(core: Core, leg: number): Promise<{ ids: string[]; v: string[] }> {
  const L = core.meta.legislatures.find((l) => l.num === leg)!;
  const n = Math.ceil(L.deputies / L.voteChunk);
  const chunks = await Promise.all(Array.from({ length: n }, (_, k) => loadVoteChunk(leg, k)));
  return { ids: chunks.flatMap((c) => c.ids), v: chunks.flatMap((c) => c.v) };
}

let censPromise: Promise<Censure[]> | null = null;
export function loadCensures(): Promise<Censure[]> {
  if (!censPromise) {
    censPromise = getJSON<Censure[]>("censures.json");
    censPromise.catch(() => (censPromise = null));
  }
  return censPromise;
}

/** Petit utilitaire : résultat d'une promesse dans un composant. */
export function useAsync<T>(fn: () => Promise<T>, deps: React.DependencyList) {
  const [state, setState] = React.useState<{ data?: T; error?: Error; loading: boolean }>({ loading: true });
  React.useEffect(() => {
    let alive = true;
    setState((s) => ({ data: s.data, loading: true }));
    fn().then(
      (data) => alive && setState({ data, loading: false }),
      (error) => alive && setState({ error, loading: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export const CoreContext = React.createContext<Core | null>(null);
export function useCore(): Core {
  const c = React.useContext(CoreContext);
  if (!c) throw new Error("Données non chargées");
  return c;
}

export const IS_ARTIFACT = typeof window !== "undefined" && (window as unknown as { __QVQ_ARTIFACT__?: boolean }).__QVQ_ARTIFACT__ === true;
