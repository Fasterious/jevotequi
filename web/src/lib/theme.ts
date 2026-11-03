import React from "react";
import * as d3 from "d3";

export const famColor = (id: string) => `var(--f-${id})`;

export const VOTE_COLOR: Record<string, string> = {
  P: "var(--pour)",
  C: "var(--contre)",
  A: "var(--abst)",
  N: "var(--nv)",
  "=": "var(--split)",
  "-": "transparent",
  ".": "transparent",
};
export const VOTE_LABEL: Record<string, string> = {
  P: "Pour",
  C: "Contre",
  A: "Abstention",
  N: "Non-votant",
  "=": "Groupe partagé",
  "-": "Pas de vote",
  ".": "Absent",
};

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Incrémenté à chaque changement de thème (système ou choix explicite). */
export function useThemeVersion(): number {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const bump = () => setV((x) => x + 1);
    mq.addEventListener?.("change", bump);
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => {
      mq.removeEventListener?.("change", bump);
      mo.disconnect();
    };
  }, []);
  return v;
}

/** Échelle séquentielle (une teinte, clair → foncé ; ancrage inversé en mode sombre). */
export function useSeqScale(): (t: number) => string {
  const v = useThemeVersion();
  return React.useMemo(() => {
    const lo = cssVar("--seq-lo") || "#e6eefa";
    const hi = cssVar("--seq-hi") || "#0d366b";
    const interp = d3.interpolateLab(lo, hi);
    return (t: number) => interp(Math.max(0, Math.min(1, t)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);
}

/** Encre lisible sur un aplat : blanc ou presque noir selon la clarté. */
export function inkOn(bg: string): string {
  const c = d3.lab(bg);
  return c.l > 60 ? "#12141a" : "#ffffff";
}

/** Largeur réelle d'un conteneur : les graphiques sont dessinés à leur taille
 *  d'affichage, pour que le texte garde sa taille sur mobile comme sur écran large. */
export function useWidth<T extends HTMLElement>(fallback = 720): [React.RefObject<T>, number] {
  const ref = React.useRef<T>(null);
  const [w, setW] = React.useState(fallback);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const first = Math.round(el.getBoundingClientRect().width);
    if (first > 0) setW(first);
    const ro = new ResizeObserver((entries) => {
      const cw = Math.round(entries[0].contentRect.width);
      if (cw > 0) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
