import React from "react";
import * as d3 from "d3";
import { useCore } from "../lib/data";
import { famColor, inkOn, useSeqScale, useWidth } from "../lib/theme";
import { fmtInt, fmtPct, fmtDateShort } from "../lib/format";
import { href, go } from "../lib/router";
import { rate, type Agreement, type SeriesPoint } from "../lib/stats";
import { FamChip, FamDot } from "./ui";
import { useTipHandlers, useTooltip } from "./Tooltip";

/* ------------------------------------------------------------------ infobulle d'accord */

export function AgreementTip({ a, b, ag, scopeLabel }: { a: React.ReactNode; b: React.ReactNode; ag: Agreement; scopeLabel?: string }) {
  const r = rate(ag);
  return (
    <div>
      <div className="tv">{fmtPct(r)}</div>
      <div>
        {a} et {b} ont voté de la même façon dans {fmtInt(ag.same)} scrutins sur {fmtInt(ag.total)}
        {scopeLabel ? ` (${scopeLabel})` : ""}.
      </div>
      {ag.total > 0 && (
        <>
          <hr />
          <div className="tk">
            Votes opposés : {fmtPct(ag.opp / ag.total)} · l'un s'abstient : {fmtPct(ag.partial / ag.total)}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ barres classées */

export interface RankRow {
  id: string;
  label: React.ReactNode;
  dot?: string;
  ag: Agreement;
  link: string;
  tip: () => React.ReactNode;
}

export function RankBars({ rows, minTotal = 1 }: { rows: RankRow[]; minTotal?: number }) {
  const tip = useTipHandlers();
  const sorted = [...rows].sort((x, y) => (rate(y.ag) ?? -1) - (rate(x.ag) ?? -1));
  return (
    <div className="rank-wrap">
      <div className="rank" role="list">
        {sorted.map((r) => {
          const v = r.ag.total >= minTotal ? rate(r.ag) : null;
          const w = v == null ? 0 : v * 100;
          const inside = v != null && v >= 0.82;
          const fragile = r.ag.total > 0 && r.ag.total < 30;
          return (
            <a
              key={r.id}
              role="listitem"
              className={`rank-row${fragile ? " fragile" : ""}`}
              href={r.link}
              {...tip(() => (
                <>
                  {r.tip()}
                  {fragile && <div className="tk">Moins de 30 scrutins : résultat fragile.</div>}
                </>
              ))}
            >
              <span className="rank-label">
                {r.dot && <FamDot id={r.dot} />}
                <span>{r.label}</span>
              </span>
              <span className="rank-track">
                <span className="rank-bar" style={{ width: `${w}%` }} />
                <span className={`rank-val${inside ? " inside" : ""}`} style={inside ? { right: `${100 - w}%` } : { left: `${w}%` }}>
                  {v == null ? "pas de vote commun" : fmtPct(v)}
                </span>
              </span>
            </a>
          );
        })}
      </div>
      <div className="rank-axis" aria-hidden="true">
        <span />
        <span className="ticks">
          {[0, 25, 50, 75, 100].map((t) => (
            <span key={t} style={{ left: `${t}%` }}>
              {t} %
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ matrice */

export function Matrix({ fams, data, scopeLabel }: { fams: string[]; data: Agreement[][]; scopeLabel?: string }) {
  const core = useCore();
  const seq = useSeqScale();
  const tip = useTipHandlers();
  return (
    <div className="scroll-x">
      <table className="heat" aria-label="Taux d'accord entre groupes, en % des scrutins">
        <thead>
          <tr>
            <th />
            {fams.map((f) => (
              <th key={f} scope="col">
                <span className="vert">
                  <FamDot id={f} />
                  {core.famById[f].short}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fams.map((a, ia) => (
            <tr key={a}>
              <th scope="row">
                <FamChip id={a} />
              </th>
              {fams.map((b, ib) => {
                if (ia === ib) return <td key={b} className="diag" aria-label="même groupe" />;
                const ag = data[ia][ib];
                const r = rate(ag);
                if (r == null || ag.total < 10)
                  return (
                    <td key={b} className="empty">
                      ·
                    </td>
                  );
                const bg = seq(r);
                return (
                  <td
                    key={b}
                    tabIndex={0}
                    style={{ background: bg, color: inkOn(bg) }}
                    onClick={() => go({ page: "compare", a, b })}
                    onKeyDown={(e) => e.key === "Enter" && go({ page: "compare", a, b })}
                    {...tip(() => <AgreementTip a={<FamChip id={a} />} b={<FamChip id={b} />} ag={ag} scopeLabel={scopeLabel} />)}
                  >
                    {Math.round(r * 100)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RampLegend({ label = "Part des scrutins où les deux groupes ont voté pareil" }: { label?: string }) {
  const seq = useSeqScale();
  const stops = d3.range(0, 1.01, 0.1).map((t) => `${seq(t)} ${t * 100}%`);
  return (
    <div className="legend-ramp">
      <span>0 %</span>
      <span className="ramp" style={{ background: `linear-gradient(to right, ${stops.join(",")})` }} />
      <span>100 %</span>
      <span>· {label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ thème × groupe */

export function ThemeHeat({
  refFam,
  fams,
  rows,
}: {
  refFam: string;
  fams: string[];
  rows: { theme: number; label: string; cells: Agreement[]; n: number }[];
}) {
  const core = useCore();
  const seq = useSeqScale();
  const tip = useTipHandlers();
  return (
    <div className="scroll-x">
      <table className="heat" aria-label={`Taux d'accord avec ${core.famById[refFam].short} par thème`}>
        <thead>
          <tr>
            <th />
            {fams.map((f) => (
              <th key={f} scope="col">
                <span className="vert">
                  <FamDot id={f} />
                  {core.famById[f].short}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.theme}>
              <th scope="row" style={{ fontWeight: 650 }}>
                {row.label} <span className="muted tiny num">({fmtInt(row.n)})</span>
              </th>
              {row.cells.map((ag, k) => {
                const f = fams[k];
                const r = rate(ag);
                if (r == null || ag.total < 15)
                  return (
                    <td key={f} className="empty" title="Moins de 15 scrutins communs">
                      ·
                    </td>
                  );
                const bg = seq(r);
                return (
                  <td
                    key={f}
                    tabIndex={0}
                    style={{ background: bg, color: inkOn(bg) }}
                    onClick={() => go({ page: "compare", a: f, b: refFam })}
                    {...tip(() => (
                      <AgreementTip a={<FamChip id={f} />} b={<FamChip id={refFam} />} ag={ag} scopeLabel={row.label.toLowerCase()} />
                    ))}
                  >
                    {Math.round(r * 100)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ bandes de gouvernement */

export interface Band {
  label: string;
  from: string;
  to: string;
}

export function useGovBands(): Band[] {
  const core = useCore();
  return React.useMemo(() => {
    const out: Band[] = [];
    for (const g of core.meta.governments) {
      const last = g.pm.split(" ").slice(-1)[0];
      const to = g.to ?? core.s.date[core.N - 1];
      const prev = out[out.length - 1];
      if (prev && prev.label === last) prev.to = to;
      else out.push({ label: last, from: g.from, to });
    }
    return out;
  }, [core]);
}

const parse = (d: string) => new Date(d + "T00:00:00Z");

/* ------------------------------------------------------------------ petits multiples */

export function MiniSeries({
  fam,
  refFam,
  points,
  overall,
  domain,
  minTotal = 20,
}: {
  fam: string;
  refFam: string;
  points: SeriesPoint[];
  overall: Agreement;
  domain: [Date, Date];
  minTotal?: number;
}) {
  const core = useCore();
  const bands = useGovBands();
  const [box, W] = useWidth<HTMLDivElement>(240);
  const H = 96,
    m = { t: 6, r: 8, b: 16, l: 26 };
  const x = d3.scaleUtc().domain(domain).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([0, 1]).range([H - m.b, m.t]);
  const mid = (p: SeriesPoint) => new Date((parse(p.start).getTime() + parse(p.end).getTime()) / 2);
  const ok = (p: SeriesPoint) => p.ag.total >= minTotal;
  const line = d3
    .line<SeriesPoint>()
    .defined(ok)
    .x((p) => x(mid(p)))
    .y((p) => y(p.ag.same / p.ag.total))
    .curve(d3.curveMonotoneX);
  const area = d3
    .area<SeriesPoint>()
    .defined(ok)
    .x((p) => x(mid(p)))
    .y0(y(0))
    .y1((p) => y(p.ag.same / p.ag.total))
    .curve(d3.curveMonotoneX);
  const valid = points.filter(ok);
  const lastP = valid[valid.length - 1];
  const [hover, setHover] = React.useState<SeriesPoint | null>(null);
  const tt = useTooltip();
  const onMove = (e: React.PointerEvent<SVGRectElement>): SeriesPoint | null => {
    const svg = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - svg.left;
    const t = x.invert(px).getTime();
    let best: SeriesPoint | null = null;
    let bd = Infinity;
    for (const p of valid) {
      const d = Math.abs(mid(p).getTime() - t);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    setHover(best);
    return best;
  };
  const r = rate(overall);
  return (
    <div className="multiple" ref={box}>
      <div className="multiple-head">
        <a href={href({ page: "compare", a: fam, b: refFam })} style={{ textDecoration: "none", fontWeight: 650 }}>
          <FamChip id={fam} />
        </a>
        <span className="num" style={{ fontWeight: 700 }}>
          {fmtPct(r)}
        </span>
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Accord de ${core.famById[fam].short} avec ${core.famById[refFam].short} par trimestre`}>
        {bands.map((b, k) => (
          <rect
            key={b.label + b.from}
            className={`gov-band${k % 2 ? " alt" : ""}`}
            x={x(parse(b.from))}
            width={Math.max(0, x(parse(b.to)) - x(parse(b.from)))}
            y={m.t}
            height={H - m.b - m.t}
          />
        ))}
        <g className="grid">
          {[0, 0.5, 1].map((t) => (
            <line key={t} x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        {[0, 0.5, 1].map((t) => (
          <text key={t} x={m.l - 4} y={y(t) + 3.5} textAnchor="end">
            {t * 100}
          </text>
        ))}
        {[2023, 2024, 2025, 2026].map((yr) => {
          const d = new Date(Date.UTC(yr, 0, 1));
          if (d < domain[0] || d > domain[1]) return null;
          return (
            <text key={yr} x={x(d)} y={H - 3} textAnchor="middle">
              {yr}
            </text>
          );
        })}
        <path d={area(points) ?? ""} style={{ fill: famColor(fam), opacity: 0.12 }} />
        <path d={line(points) ?? ""} style={{ fill: "none", stroke: famColor(fam), strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }} />
        {lastP && <circle cx={x(mid(lastP))} cy={y(lastP.ag.same / lastP.ag.total)} r={3.5} style={{ fill: famColor(fam), stroke: "var(--surface)", strokeWidth: 1.5 }} />}
        {hover && (
          <g>
            <line x1={x(mid(hover))} x2={x(mid(hover))} y1={m.t} y2={H - m.b} style={{ stroke: "var(--ink-2)", strokeWidth: 1 }} />
            <circle cx={x(mid(hover))} cy={y(hover.ag.same / hover.ag.total)} r={4} style={{ fill: famColor(fam), stroke: "var(--surface)", strokeWidth: 2 }} />
          </g>
        )}
        <rect
          x={m.l}
          y={0}
          width={W - m.l - m.r}
          height={H}
          fill="transparent"
          onPointerMove={(e) => {
            const p = onMove(e);
            if (p && e.pointerType !== "touch")
              tt.show(
                e.clientX,
                e.clientY,
                <div>
                  <div className="tv">{fmtPct(p.ag.same / p.ag.total)}</div>
                  <div>
                    {p.key.replace("-T", ", T")} : <FamChip id={fam} /> et <FamChip id={refFam} /> ont voté pareil sur {fmtInt(p.ag.same)} des{" "}
                    {fmtInt(p.ag.total)} scrutins du trimestre.
                  </div>
                </div>,
              );
          }}
          onPointerLeave={() => {
            setHover(null);
            tt.hide();
          }}
        />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ série unique (comparateur) */

export function TimeChart({ points, minTotal = 15, label }: { points: SeriesPoint[]; minTotal?: number; label: string }) {
  const bands = useGovBands();
  const tt = useTooltip();
  const [box, W] = useWidth<HTMLDivElement>(720);
  const H = 220,
    m = { t: 26, r: 14, b: 24, l: 40 };
  const domain: [Date, Date] = [parse(points[0].start), parse(points[points.length - 1].end)];
  const x = d3.scaleUtc().domain(domain).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([0, 1]).range([H - m.b, m.t]);
  const mid = (p: SeriesPoint) => new Date((parse(p.start).getTime() + parse(p.end).getTime()) / 2);
  const ok = (p: SeriesPoint) => p.ag.total >= minTotal;
  const valid = points.filter(ok);
  const line = d3
    .line<SeriesPoint>()
    .defined(ok)
    .x((p) => x(mid(p)))
    .y((p) => y(p.ag.same / p.ag.total))
    .curve(d3.curveMonotoneX);
  const [hover, setHover] = React.useState<SeriesPoint | null>(null);
  return (
    <div ref={box}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={label} style={{ display: "block" }}>
      {bands.map((b, k) => {
        const x0 = x(parse(b.from)),
          x1 = x(parse(b.to));
        return (
          <g key={b.label + b.from}>
            <rect className={`gov-band${k % 2 ? " alt" : ""}`} x={x0} width={Math.max(0, x1 - x0)} y={m.t} height={H - m.b - m.t} />
            {x1 - x0 > 34 && (
              <text x={(x0 + x1) / 2} y={m.t - 8} textAnchor="middle">
                {b.label}
              </text>
            )}
          </g>
        );
      })}
      <g className="grid">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />
        ))}
      </g>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <text key={t} x={m.l - 6} y={y(t) + 4} textAnchor="end">
          {t * 100} %
        </text>
      ))}
      {[2023, 2024, 2025, 2026].map((yr) => {
        const d = new Date(Date.UTC(yr, 0, 1));
        if (d < domain[0] || d > domain[1]) return null;
        return (
          <text key={yr} x={x(d)} y={H - 6} textAnchor="middle">
            {yr}
          </text>
        );
      })}
      <path d={line(points) ?? ""} style={{ fill: "none", stroke: "var(--agree)", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }} />
      {valid.map((p) => (
        <circle key={p.key} cx={x(mid(p))} cy={y(p.ag.same / p.ag.total)} r={hover === p ? 5 : 3} style={{ fill: "var(--agree)", stroke: "var(--surface)", strokeWidth: 2 }} />
      ))}
      {valid.map((p) => {
        const x0 = x(parse(p.start)),
          x1 = x(parse(p.end));
        return (
          <rect
            key={"h" + p.key}
            x={x0}
            y={0}
            width={Math.max(1, x1 - x0)}
            height={H}
            fill="transparent"
            onPointerMove={(e) => {
              setHover(p);
              if (e.pointerType !== "touch")
                tt.show(
                  e.clientX,
                  e.clientY,
                  <div>
                    <div className="tv">{fmtPct(p.ag.same / p.ag.total)}</div>
                    <div>
                      Du {fmtDateShort(p.start)} au {fmtDateShort(p.end)} : même vote sur {fmtInt(p.ag.same)} des {fmtInt(p.ag.total)} scrutins.
                    </div>
                  </div>,
                );
            }}
            onPointerLeave={() => {
              setHover(null);
              tt.hide();
            }}
          />
        );
      })}
    </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ barres horizontales simples */

export function SimpleBars({ rows }: { rows: { key: string; label: string; ag: Agreement; onClick?: () => void }[] }) {
  const tip = useTipHandlers();
  return (
    <div className="rank simple" role="list">
      {rows.map((r) => {
        const v = rate(r.ag);
        const w = v == null ? 0 : v * 100;
        const inside = v != null && v >= 0.82;
        const fragile = r.ag.total > 0 && r.ag.total < 30;
        return (
          <div
            key={r.key}
            role="listitem"
            className={`rank-row${fragile ? " fragile" : ""}`}
            tabIndex={r.onClick ? 0 : undefined}
            onClick={r.onClick}
            style={{ cursor: r.onClick ? "pointer" : "default" }}
            {...tip(() => (
              <div>
                <div className="tv">{fmtPct(v)}</div>
                <div>
                  {r.label} : même vote sur {fmtInt(r.ag.same)} des {fmtInt(r.ag.total)} scrutins.
                </div>
                {fragile && <div className="tk">Moins de 30 scrutins : résultat fragile.</div>}
              </div>
            ))}
          >
            <span className="rank-label">
              <span>{r.label}</span>
            </span>
            <span className="rank-track">
              <span className="rank-bar" style={{ width: `${w}%`, background: "var(--agree)" }} />
              <span className={`rank-val${inside ? " inside" : ""}`} style={inside ? { right: `${100 - w}%` } : { left: `${w}%` }}>
                {fmtPct(v)} <small>{fmtInt(r.ag.total)}</small>
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
