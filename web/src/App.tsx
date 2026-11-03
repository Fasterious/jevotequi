import React from "react";
import { CoreContext, loadCore, useAsync, type Core } from "./lib/data";
import { useRoute, type Route } from "./lib/router";
import { DEFAULT_SCOPE, isDeputyId, type Scope } from "./lib/stats";
import { TooltipProvider } from "./components/Tooltip";
import { Footer, Header, HelpBanner } from "./components/Layout";
import { ErrorBox, Loading, ScopeContext } from "./components/ui";
import { Home } from "./pages/Home";
import { Compare } from "./pages/Compare";
import { Scrutins } from "./pages/Scrutins";
import { ScrutinPage } from "./pages/ScrutinPage";
import { Deputes } from "./pages/Deputes";
import { DeputePage } from "./pages/DeputePage";
import { Groupe } from "./pages/Groupe";
import { Methode } from "./pages/Methode";
import { Quiz } from "./pages/Quiz";
import { Projet } from "./pages/Projet";

function useScopeState(): [Scope, (s: Scope) => void] {
  const [scope, setScope] = React.useState<Scope>(() => {
    try {
      const raw = sessionStorage.getItem("qvq-scope");
      return raw ? { ...DEFAULT_SCOPE, ...JSON.parse(raw) } : DEFAULT_SCOPE;
    } catch {
      return DEFAULT_SCOPE;
    }
  });
  const set = React.useCallback((s: Scope) => {
    setScope(s);
    try {
      sessionStorage.setItem("qvq-scope", JSON.stringify(s));
    } catch {
      /* stockage indisponible : le filtre reste en mémoire */
    }
  }, []);
  return [scope, set];
}

function pageTitle(route: Route, core: Core): string {
  const base = "Je vote qui ?";
  switch (route.page) {
    case "compare": {
      const n = (id?: string) => (id && !isDeputyId(id) ? core.famById[id]?.short : null);
      const a = n(route.a),
        b = n(route.b);
      return a && b ? `${a} et ${b} · ${base}` : `Comparer · ${base}`;
    }
    case "scrutins":
      return `Tous les scrutins · ${base}`;
    case "scrutin":
      return `Scrutin n° ${route.num} (${route.leg}e législature) · ${base}`;
    case "deputes":
      return `Députés · ${base}`;
    case "groupe":
      return `${core.famById[route.id]?.name ?? "Groupe"} · ${base}`;
    case "methode":
      return `Méthode · ${base}`;
    case "quiz":
      return route.code ? `Résultats du quiz · ${base}` : `Le quiz : et toi, tu aurais voté quoi ? · ${base}`;
    case "projet":
      return `Le projet · ${base}`;
    default:
      return base;
  }
}

function Page({ route }: { route: Route }) {
  switch (route.page) {
    case "home":
      return <Home />;
    case "compare":
      return <Compare a={route.a} b={route.b} />;
    case "scrutins":
      return <Scrutins />;
    case "scrutin":
      return <ScrutinPage leg={route.leg} num={route.num} />;
    case "deputes":
      return <Deputes />;
    case "depute":
      return <DeputePage id={route.id} />;
    case "groupe":
      return <Groupe id={route.id} />;
    case "methode":
      return <Methode />;
    case "quiz":
      return <Quiz code={route.code} />;
    case "projet":
      return <Projet section={route.section} />;
    default:
      return (
        <div className="wrap page">
          <p>
            Cette page n'existe pas. <a href="#accueil">Retour à l'accueil</a>.
          </p>
        </div>
      );
  }
}

export function App() {
  const route = useRoute();
  const core = useAsync(loadCore, []);
  const [scope, setScope] = useScopeState();
  React.useEffect(() => {
    if (core.data) document.title = pageTitle(route, core.data);
  }, [route, core.data]);
  return (
    <>
      <Header route={route} />
      {route.page !== "projet" && <HelpBanner />}
      {core.error ? (
        <div className="wrap page">
          <ErrorBox error={core.error} />
        </div>
      ) : !core.data ? (
        <Loading label="Chargement des scrutins de l'Assemblée…" />
      ) : (
        <CoreContext.Provider value={core.data}>
          <ScopeContext.Provider value={[scope, setScope]}>
            <TooltipProvider>
              <main>
                <Page route={route} />
              </main>
              <Footer />
            </TooltipProvider>
          </ScopeContext.Provider>
        </CoreContext.Provider>
      )}
    </>
  );
}
