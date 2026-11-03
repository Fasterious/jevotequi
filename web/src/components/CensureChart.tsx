import React from "react";
import * as d3 from "d3";
import { useCore } from "../lib/data";
import { famColor, useWidth } from "../lib/theme";
import { fmtDate, fmtInt } from "../lib/format";
import { go } from "../lib/router";
import { FamChip } from "./ui";
import { useTooltip } from "./Tooltip";
import { useGovBands } from "./charts";
import type { Censure } from "../lib/types";

/** Motions de censure : barres empilées par famille, seuil de 289 voix. */
export function CensureChart({ items, highlightFam }: { items: Censure[]; highlightFam?: string }) {
  const core = useCore();
  const tt = useTooltip();
  const bands = useGovBands();
  const fams = core.meta.families.map((f) => f.id);
  const [box, cw] = useWidth<HTMLDivElement>(900);
  const W = Math.max(cw, 640, items.length * 9 + 80),
    H = 340,
    m = { t: 30, r: 16, b: 34, l: 40 };
  const x = d3
    .scaleBand<number>()
    .domain(items.map((_, k) => k))
    .range([m.l, W - m.r])
    .paddingInner(0.25)
    .paddingOuter(0.2);
  const ymax = Math.max(360, d3.max(items, (c) => c.pour) ?? 0);
  const y = d3.scaleLinear().domain([0, ymax]).range([H - m.b, m.t]);
  const bw = Math.min(16, x.bandwidth());
  // bandes de gouvernement projetées sur l'axe des motions (ordre chronologique)
  const bandSpans = bands
    .map((b) => {
      const ks = items.map((c, k) => (c.date >= b.from && c.date <= b.to ? k : -1)).filter((k) => k >= 0);
      if (!ks.length) return null;
      const x0 = x(ks[0])! - (x.step() * x.paddingInner()) / 2;
      const x1 = x(ks[ks.length - 1])! + x.bandwidth() + (x.step() * x.paddingInner()) / 2;
      return { ...b, x0, x1 };
    })
    .filter(Boolean) as { label: string; x0: number; x1: number }[];
  return (
    <div className="scroll-x" ref={box}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Votes pour chaque motion de censure" style={{ display: "block" }}>
        {bandSpans.map((b, k) => (
          <g key={b.label + k}>
            <rect className={`gov-band${k % 2 ? " alt" : ""}`} x={b.x0} width={b.x1 - b.x0} y={m.t} height={H - m.b - m.t} />
            <text x={(b.x0 + b.x1) / 2} y={m.t - 10} textAnchor="middle">
              {b.label}
            </text>
          </g>
        ))}
        <g className="grid">
          {[0, 100, 200, 300].map((t) => (
            <line key={t} x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        {[0, 100, 200, 300].map((t) => (
          <text key={t} x={m.l - 6} y={y(t) + 4} textAnchor="end">
            {t}
          </text>
        ))}
        {items.map((c, k) => {
          let acc = 0;
          const x0 = x(k)! + (x.bandwidth() - bw) / 2;
          const dim = highlightFam ? !(c.fam[highlightFam] && c.fam[highlightFam][0] > 0) : false;
          return (
            <g
              key={c.i}
              style={{ cursor: "pointer", opacity: dim ? 0.35 : 1 }}
              onPointerMove={(e) => e.pointerType !== "touch" && tt.show(e.clientX, e.clientY, <CensureTip c={c} />)}
              onPointerLeave={() => tt.hide()}
              onClick={() => go({ page: "scrutin", leg: c.leg, num: c.num })}
            >
              <rect x={x(k)} y={m.t} width={x.bandwidth()} height={H - m.b - m.t} fill="transparent" />
              {fams.map((f) => {
                const v = c.fam[f]?.[0] ?? 0;
                if (!v) return null;
                const y0 = y(acc),
                  y1 = y(acc + v);
                acc += v;
                return <rect key={f} x={x0} width={bw} y={y1} height={Math.max(0, y0 - y1 - 1)} style={{ fill: famColor(f) }} />;
              })}
              <line x1={x0 - 3} x2={x0 + bw + 3} y1={y(c.requis)} y2={y(c.requis)} style={{ stroke: "var(--ink)", strokeWidth: 2 }} />
              {c.adopted && (
                <text x={x0 + bw / 2} y={y(c.pour) - 6} textAnchor="middle" className="label-strong">
                  Adoptée
                </text>
              )}
            </g>
          );
        })}
        <line x1={m.l} x2={W - m.r} y1={y(289)} y2={y(289)} style={{ stroke: "var(--line-2)", strokeWidth: 1 }} />
        <text x={W - m.r} y={y(289) - 14} textAnchor="end" className="label-strong">
          Majorité absolue (289 voix, un peu moins si des sièges sont vacants)
        </text>
        {[2023, 2024, 2025, 2026].map((yr) => {
          const k = items.findIndex((c) => c.date >= `${yr}-01-01`);
          if (k <= 0) return null;
          return (
            <text key={yr} x={x(k)! + x.bandwidth() / 2} y={H - 10} textAnchor="middle">
              {yr}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function CensureTip({ c }: { c: Censure }) {
  const core = useCore();
  const fams = core.meta.families.map((f) => f.id).filter((f) => c.fam[f] && c.fam[f][0] > 0);
  return (
    <div>
      <div className="tv">
        {fmtInt(c.pour)} voix · {c.adopted ? "adoptée" : "rejetée"}
      </div>
      <div>
        {fmtDate(c.date)} · art. {c.article === "49-3" ? "49.3 (texte adopté sans vote)" : "49.2 (motion spontanée)"}
      </div>
      <div className="tk">
        Majorité requise : {fmtInt(c.requis)} voix —{" "}
        {c.adopted ? `adoptée avec ${fmtInt(c.pour - c.requis)} voix d'avance` : `il a manqué ${fmtInt(c.requis - c.pour)} voix`}
      </div>
      {c.context && (
        <div className="tk">
          Sur{c.contextMethod === "date (probable)" ? " (probablement)" : ""} : {c.context}
        </div>
      )}
      {c.authors && <div className="tk">Déposée par {c.authors}</div>}
      <hr />
      {fams.map((f) => (
        <div key={f} className="spread" style={{ gap: "0.75rem" }}>
          <FamChip id={f} />
          <span className="num">
            {c.fam[f][0]} / {c.fam[f][1]}
          </span>
        </div>
      ))}
    </div>
  );
}
