import React from "react";

/* Routage par ancre simple (#nom) : seul ce format survit au partage d'un lien
   dans tous les contextes d'hébergement. Les segments sont séparés par des tirets. */
export type Route =
  | { page: "home" }
  | { page: "compare"; a?: string; b?: string }
  | { page: "scrutins" }
  | { page: "scrutin"; leg: number; num: number }
  | { page: "deputes" }
  | { page: "depute"; id: string }
  | { page: "groupe"; id: string }
  | { page: "methode" }
  | { page: "quiz"; code?: string }
  | { page: "projet"; section?: string }
  | { page: "notfound" };

export function parseHash(hash: string): Route {
  const h = decodeURIComponent(hash.replace(/^#\/?/, "")).trim();
  if (!h || h === "accueil") return { page: "home" };
  const parts = h.split("-");
  switch (parts[0]) {
    case "comparer":
      return { page: "compare", a: parts[1] || undefined, b: parts[2] || undefined };
    case "scrutins":
      return { page: "scrutins" };
    case "scrutin": {
      const leg = Number(parts[1]);
      const num = Number(parts[2]);
      return Number.isFinite(leg) && Number.isFinite(num) ? { page: "scrutin", leg, num } : { page: "notfound" };
    }
    case "deputes":
      return { page: "deputes" };
    case "depute":
      return parts[1] ? { page: "depute", id: parts[1] } : { page: "deputes" };
    case "groupe":
      return parts[1] ? { page: "groupe", id: parts[1] } : { page: "home" };
    case "methode":
      return { page: "methode" };
    case "quiz":
      return { page: "quiz", code: parts[1] || undefined };
    case "projet":
      return { page: "projet", section: parts[1] || undefined };
    default:
      return { page: "notfound" };
  }
}

export function href(r: Route): string {
  switch (r.page) {
    case "home":
      return "#accueil";
    case "compare":
      return `#comparer${r.a ? "-" + r.a : ""}${r.b ? "-" + r.b : ""}`;
    case "scrutins":
      return "#scrutins";
    case "scrutin":
      return `#scrutin-${r.leg}-${r.num}`;
    case "deputes":
      return "#deputes";
    case "depute":
      return `#depute-${r.id}`;
    case "groupe":
      return `#groupe-${r.id}`;
    case "methode":
      return "#methode";
    case "quiz":
      return r.code ? `#quiz-${r.code}` : "#quiz";
    case "projet":
      return r.section ? `#projet-${r.section}` : "#projet";
    default:
      return "#accueil";
  }
}

export function useRoute(): Route {
  const [route, setRoute] = React.useState<Route>(() => parseHash(window.location.hash));
  React.useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function go(r: Route) {
  window.location.hash = href(r);
}
