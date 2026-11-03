import React from "react";
import * as d3 from "d3";
import { fold, useCore, type DeputyIndex } from "../lib/data";
import { famColor, useWidth } from "../lib/theme";
import { fmtInt, fmtPct } from "../lib/format";
import { go } from "../lib/router";
import { FamChip } from "./ui";
import { useTooltip } from "./Tooltip";
import type { Deputy } from "../lib/types";

interface Pt {
  d: Deputy;
  fam: string;
  x: number;
  y: number;
  votes: number;
}

/** Carte des députés : positionnement multidimensionnel calculé à partir du taux de
 *  désaccord entre chaque paire de députés (voir la méthode). */
export function DeputyMap({ deps, leg }: { deps: DeputyIndex; leg: number }) {
  const core = useCore();
  const tt = useTooltip();
  const [focusFam, setFocusFam] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [hover, setHover] = React.useState<Pt | null>(null);
  const [box, W] = useWidth<HTMLDivElement>(860);
  const pad = W < 500 ? 16 : 30;
  const dotR = W < 500 ? 3.1 : 4.2;
  const pts: Pt[] = React.useMemo(() => {
    const out: Pt[] = [];
    for (const d of deps.list) {
      const L = d.legs[String(leg)];
      if (!L || !L.xy) continue;
      out.push({ d, fam: L.fam, x: L.xy[0], y: L.xy[1], votes: L.votes });
    }
    return out;
  }, [deps, leg]);
  // Même échelle sur les deux axes (les distances doivent rester comparables),
  // hauteur ajustée à l'étendue des points.
  const geo = React.useMemo(() => {
    const [x0, x1] = d3.extent(pts, (p) => p.x) as [number, number];
    const [y0, y1] = d3.extent(pts, (p) => p.y) as [number, number];
    const xr = x1 - x0 || 1,
      yr = y1 - y0 || 1;
    let k = (W - 2 * pad) / xr;
    let H = yr * k + 2 * pad;
    if (H > 620) {
      k = (620 - 2 * pad) / yr;
      H = 620;
    }
    H = Math.max(H, W < 500 ? 260 : 320);
    const offX = (W - 2 * pad - xr * k) / 2,
      offY = (H - 2 * pad - yr * k) / 2;
    return { H, fx: (v: number) => pad + offX + (v - x0) * k, fy: (v: number) => H - pad - offY - (v - y0) * k };
  }, [pts, W, pad]);
  const H = geo.H;
  const x = geo.fx,
    y = geo.fy;
  const delaunay = React.useMemo(() => d3.Delaunay.from(pts, (p) => geo.fx(p.x), (p) => geo.fy(p.y)), [pts, geo]);
  const fams = React.useMemo(() => {
    const present = new Set(pts.map((p) => p.fam));
    return core.meta.families.map((f) => f.id).filter((f) => present.has(f));
  }, [pts, core]);
  const centroids = React.useMemo(() => {
    const raw = fams
      .filter((f) => f !== "NI")
      .map((f) => {
        const ps = pts.filter((p) => p.fam === f);
        return { f, n: ps.length, px: geo.fx(d3.median(ps, (p) => p.x)!), py: geo.fy(d3.median(ps, (p) => p.y)!) };
      })
      .filter((c) => c.n >= 5)
      .sort((a, b) => b.n - a.n);
    // évite que deux étiquettes se chevauchent : on décale verticalement si besoin
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const out: { f: string; px: number; py: number }[] = [];
    for (const c of raw) {
      const w = core.famById[c.f].short.length * 7.6 + 10,
        h = 17;
      c.px = Math.max(w / 2 + 2, Math.min(W - w / 2 - 2, c.px));
      const tries = [0, -18, 18, -36, 36, -54, 54];
      let best = c.py;
      for (const dy of tries) {
        const b = { x0: c.px - w / 2, x1: c.px + w / 2, y0: c.py + dy - h / 2, y1: c.py + dy + h / 2 };
        if (!placed.some((q) => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0)) {
          best = c.py + dy;
          placed.push(b);
          break;
        }
      }
      out.push({ f: c.f, px: c.px, py: best });
    }
    return out;
  }, [pts, fams, geo, core, W]);
  const q = fold(query.trim());
  const found = q.length >= 3 ? pts.filter((p) => fold(`${p.d.prenom} ${p.d.nom}`).includes(q)).slice(0, 8) : [];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const py = ((e.clientY - r.top) / r.height) * H;
    const k = delaunay.find(px, py);
    const p = pts[k];
    if (!p) return;
    const dist = Math.hypot(x(p.x) - px, y(p.y) - py);
    if (dist > 22) {
      setHover(null);
      tt.hide();
      return;
    }
    setHover(p);
    if (e.pointerType !== "touch") tt.show(e.clientX, e.clientY, <MapTip p={p} leg={leg} />);
  };

  return (
    <div className="stack">
      <div className="spread">
        <div className="legend" role="group" aria-label="Mettre un groupe en évidence">
          {fams.map((f) => (
            <button key={f} type="button" aria-pressed={focusFam === f} onClick={() => setFocusFam(focusFam === f ? null : f)}>
              <span className="sw round" style={{ background: famColor(f) }} />
              {core.famById[f].short}
            </button>
          ))}
        </div>
        <label className="ctl" style={{ minWidth: "min(100%, 15rem)" }}>
          <span className="sr-only">Chercher un député sur la carte</span>
          <input className="input" type="search" id={`map-search-${leg}`} placeholder="Chercher un député sur la carte" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      <div className="map-box" ref={box}>
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="chart"
          role="img"
          aria-label={`Carte des ${fmtInt(pts.length)} députés selon leurs votes`}
          onPointerMove={onMove}
          onPointerLeave={() => {
            setHover(null);
            tt.hide();
          }}
          onClick={() => hover && go({ page: "depute", id: hover.d.id })}
          style={{ cursor: hover ? "pointer" : "default" }}
        >
          <rect x={0} y={0} width={W} height={H} fill="transparent" />
          <line x1={x(0)} x2={x(0)} y1={pad / 2} y2={H - pad / 2} style={{ stroke: "var(--line)" }} />
          <line x1={pad / 2} x2={W - pad / 2} y1={y(0)} y2={y(0)} style={{ stroke: "var(--line)" }} />
          {pts.map((p) => {
            const dim = (focusFam && p.fam !== focusFam) || (found.length > 0 && !found.includes(p));
            return (
              <circle
                key={p.d.id}
                cx={x(p.x)}
                cy={y(p.y)}
                r={dotR}
                style={{ fill: famColor(p.fam), stroke: "var(--surface)", strokeWidth: 1.2, opacity: dim ? 0.13 : 0.92 }}
              />
            );
          })}
          {centroids.map((c) => (
            <text
              key={c.f}
              className="centroid"
              x={c.px}
              y={c.py}
              textAnchor="middle"
              dy="0.35em"
              style={{ opacity: focusFam && focusFam !== c.f ? 0.25 : 1 }}
            >
              {core.famById[c.f].short}
            </text>
          ))}
          {[...found, ...(hover ? [hover] : [])].map((p) => (
            <g key={"hl" + p.d.id} pointerEvents="none">
              <circle cx={x(p.x)} cy={y(p.y)} r={9} style={{ fill: "none", stroke: "var(--ink)", strokeWidth: 2 }} />
              {found.includes(p) && (
                <text x={x(p.x) + 12} y={y(p.y) + 4} className="centroid" style={{ fontSize: 12 }}>
                  {p.d.prenom} {p.d.nom}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function MapTip({ p, leg }: { p: Pt; leg: number }) {
  const L = p.d.legs[String(leg)];
  const loyal = L.loyal[1] ? L.loyal[0] / L.loyal[1] : null;
  return (
    <div>
      <div className="tv">
        {p.d.prenom} {p.d.nom}
      </div>
      <div>
        <FamChip id={p.fam} long />
        {L.dept ? ` · ${L.dept}` : ""}
      </div>
      <hr />
      <div className="tk">
        {fmtInt(L.votes)} votes · vote comme son groupe : {fmtPct(loyal)}
      </div>
      <div className="tk">Cliquez pour voir sa fiche.</div>
    </div>
  );
}
