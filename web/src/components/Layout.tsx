import React from "react";
import { IS_ARTIFACT, useCore } from "../lib/data";
import { fmtDate, fmtInt } from "../lib/format";
import { href, type Route } from "../lib/router";

export function BrandMark({ size = 30 }: { size?: number }) {
  // Hémicycle stylisé : trois rangées de sièges, un siège surligné.
  const dots: { x: number; y: number; hl?: boolean }[] = [];
  [7, 11, 15].forEach((r, ri) => {
    const n = 4 + ri * 2;
    for (let j = 0; j < n; j++) {
      const a = Math.PI * (1 - (j + 0.5) / n);
      dots.push({ x: 16 + r * Math.cos(a), y: 17 - r * Math.sin(a), hl: ri === 2 && j === 5 });
    }
  });
  return (
    <svg width={size} height={(size * 18) / 32} viewBox="0 0 32 18" aria-hidden="true">
      {dots.map((d, k) => (
        <circle key={k} cx={d.x} cy={d.y} r={1.55} style={{ fill: d.hl ? "#f2c200" : "var(--ink)" }} />
      ))}
    </svg>
  );
}

const NAV: { label: string; route: Route; match: Route["page"][] }[] = [
  { label: "Accueil", route: { page: "home" }, match: ["home", "groupe"] },
  { label: "Quiz", route: { page: "quiz" }, match: ["quiz"] },
  { label: "Comparer", route: { page: "compare" }, match: ["compare"] },
  { label: "Scrutins", route: { page: "scrutins" }, match: ["scrutins", "scrutin"] },
  { label: "Députés", route: { page: "deputes" }, match: ["deputes", "depute"] },
  { label: "Méthode", route: { page: "methode" }, match: ["methode"] },
];

export function Header({ route }: { route: Route }) {
  return (
    <header className="site-header">
      <div className="wrap">
        <a className="brand" href={href({ page: "home" })}>
          <BrandMark />
          Je vote qui&nbsp;?
        </a>
        <nav className="nav" aria-label="Navigation principale">
          {NAV.map((n) => (
            <a key={n.label} href={href(n.route)} aria-current={n.match.includes(route.page) ? "page" : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

/** Bandeau d'appel aux avis, sur toutes les pages ; on peut le fermer (mémorisé sur l'appareil). */
export function HelpBanner() {
  const KEY = "qvq-bandeau-avis";
  const [hidden, setHidden] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  const close = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* stockage indisponible : le bandeau reviendra à la prochaine visite */
    }
  };
  return (
    <div className="help-banner" role="region" aria-label="Appel à contributions">
      <div className="wrap">
        <p>
          <strong>Projet citoyen pour l'élection, en construction.</strong> Aidez-nous à le rendre utile pour vous.{" "}
          <a href={href({ page: "projet", section: "avis" })}>Donner mon avis →</a>
        </p>
        <button type="button" className="help-close" onClick={close} aria-label="Fermer ce bandeau">
          ✕
        </button>
      </div>
    </div>
  );
}

export function Footer() {
  const core = useCore();
  const last = core.meta.legislatures[core.meta.legislatures.length - 1].last;
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div>
          <h4>Je vote qui&nbsp;?</h4>
          <p>
            Site indépendant, sans lien avec l'Assemblée nationale ni avec aucun parti. Il compte les votes, il ne les commente pas : chaque chiffre renvoie au
            scrutin officiel.
          </p>
        </div>
        <div>
          <h4>Données</h4>
          <p>
            Source : <a href="https://data.assemblee-nationale.fr/" target="_blank" rel="noopener noreferrer">data.assemblee-nationale.fr</a>, Licence Ouverte
            Etalab 2.0.
          </p>
          <p>
            {fmtInt(core.meta.counts.scrutins)} scrutins publics, du {fmtDate(core.s.date[0])} au {fmtDate(last)}. Mise à jour : {fmtDate(core.meta.generated.slice(0, 10))}.
          </p>
        </div>
        <div>
          <h4>Comprendre</h4>
          <p>
            <a href={href({ page: "methode" })}>Méthode et limites</a> · <a href={href({ page: "scrutins" })}>Tous les scrutins</a>
          </p>
          <p>
            <a href={href({ page: "projet" })}>Le projet et nos engagements</a> · <a href={href({ page: "projet", section: "avis" })}>Donner mon avis</a>
          </p>
          <p>
            <a href="https://github.com/Fasterious/jevotequi" target="_blank" rel="noopener noreferrer">Code source</a> (logiciel libre, AGPL-3.0)
          </p>
          {!IS_ARTIFACT && (
            <p>
              <a href="data/exports/positions-groupes.csv">Télécharger les positions des groupes (CSV)</a>
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
