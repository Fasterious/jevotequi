const nf = new Intl.NumberFormat("fr-FR");
const pf = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
const pf1 = new Intl.NumberFormat("fr-FR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmtInt = (n: number) => nf.format(n);
export const fmtPct = (r: number | null | undefined) => (r == null || Number.isNaN(r) ? "—" : pf.format(r));
export const fmtPct1 = (r: number | null | undefined) => (r == null || Number.isNaN(r) ? "—" : pf1.format(r));

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS_LONG[m - 1]} ${y}`;
}
export function fmtDateShort(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
export function fmtMonthYear(iso: string): string {
  const [y, m] = iso.slice(0, 7).split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function legLabel(leg: number): string {
  return leg === 16 ? "16e législature (2022-2024)" : leg === 17 ? "17e législature (depuis 2024)" : `${leg}e législature`;
}
export function legShort(leg: number): string {
  return leg === 16 ? "2022-2024" : leg === 17 ? "depuis 2024" : `${leg}e`;
}

export function plural(n: number, one: string, many: string): string {
  return `${fmtInt(n)} ${n > 1 ? many : one}`;
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function initials(prenom: string, nom: string): string {
  const p = prenom.trim()[0] || "";
  const parts = nom.replace(/^(de |du |d'|le |la )/i, "").trim();
  return (p + (parts[0] || "")).toUpperCase();
}

export function deputyTitle(civ: string): string {
  return civ === "Mme" ? "députée" : "député";
}
