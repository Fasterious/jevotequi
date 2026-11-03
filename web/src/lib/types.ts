export type PosChar = "P" | "C" | "A" | "=" | "-";

export interface GroupMeta {
  uid: string;
  leg: number;
  abbr: string;
  label: string;
  from: string;
  to: string | null;
  color: string;
}
export interface FamilyMeta {
  id: string;
  short: string;
  name: string;
  desc: string;
  hasPosition: boolean;
  groups: GroupMeta[];
}
export interface Gov {
  id: string;
  pm: string;
  pmCiv: string;
  from: string;
  to: string | null;
  label: string;
}
export interface LegMeta {
  num: number;
  first: string;
  last: string;
  n: number;
  deputies: number;
  chunk: number;
  voteChunk: number;
  map: { n: number; explained: number[]; minVotes: number; scrutins: number } | null;
}
export interface Meta {
  generated: string;
  sources: Record<string, string>;
  legislatures: LegMeta[];
  families: FamilyMeta[];
  positionFamilies: string[];
  authors: string[];
  kinds: { id: string; label: string }[];
  themes: { id: string; label: string }[];
  governments: Gov[];
  counts: { scrutins: number; deputies: number; texts: number; amendments: number };
}
export interface ScrutinCols {
  leg: number[];
  num: number[];
  date: string[];
  kind: number[];
  solemn: number[];
  adopted: number[];
  theme: number[];
  text: number[];
  title: string[];
  reading: string[];
  pos: string[];
  tot: [number, number, number][];
  author: number[];
}
export interface TextCols {
  title: string[];
  dossier: (string | null)[];
  leg: number[];
  theme: number[];
  commission: (string | null)[];
  procedure: (string | null)[];
  n: number[];
  first: string[];
  last: string[];
}
export interface DeputyLeg {
  i: number;
  fam: string;
  hist: [number, string][];
  dept: string | null;
  deptNum: string | null;
  circo: string | null;
  from: string | null;
  to: string | null;
  fin: string | null;
  /** Périodes de mandat [début, fin] (fin nulle = en cours). */
  per: [string, string | null][];
  elig: number;
  votes: number;
  p: number;
  c: number;
  a: number;
  nv: number;
  cens: number;
  loyal: [number, number];
  agree: [number, number][];
  xy: [number, number] | null;
}
export interface Deputy {
  id: string;
  prenom: string;
  nom: string;
  civ: string;
  party: string | null;
  legs: Record<string, DeputyLeg>;
}
export interface Amendment {
  uid: string;
  num: string;
  auteur: string | null;
  auteurId: string | null;
  auteurFam: string | null;
  typeAuteur: string | null;
  signataires: string;
  article: string;
  expose: string;
  dispositif: string;
  sort: string | null;
  source?: "archive" | "document";
}
export interface ScrutinDetail {
  title: string;
  demandeur: string;
  seance: string;
  dossier: string | null;
  votants: number;
  exprimes: number;
  requis: number | null;
  annonce: string;
  tot: [number, number, number, number];
  fam: Record<string, [number, number, number, number, number]>;
  v: string;
  amdt: Amendment | null;
  lien?: { dossier: string | null; amendement: string | null };
}
export interface Censure {
  i: number;
  leg: number;
  num: number;
  date: string;
  pour: number;
  requis: number;
  adopted: boolean;
  article: string;
  context: string | null;
  contextMethod?: string | null;
  authors: string | null;
  fam: Record<string, [number, number]>;
}

export interface Check {
  id: string;
  etape: string;
  titre: string;
  statut: "ok" | "alerte" | "echec";
  valeur: string | number;
  attendu: string | number;
  detail: string;
}
export interface Coverage {
  legislatures: {
    legislature: number;
    premier: string;
    dernier: string;
    scrutins: number;
    n_numeros_manquants: number;
    scrutins_avec_dossier: number;
    scrutins_amendement: number;
    amendements_retrouves: number;
    amendements_par_source: Record<string, number>;
  }[];
  annees: { annee: string; scrutins: number; solennels: number; amendements: number; amendements_retrouves: number }[];
}
export interface Sensitivity {
  definitions: { id: string; label: string }[];
  familles: string[];
  taux: Record<string, (number | null)[]>;
  n: Record<string, number[]>;
  stabilite: Record<string, number[]>;
}
export interface SourceInfo {
  url: string;
  size?: number;
  sha256?: string;
  last_modified?: string;
  fetched_at?: string;
  unavailable?: string;
}
