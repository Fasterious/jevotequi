import React from "react";
import { useCore } from "../lib/data";
import { famColor, VOTE_COLOR, VOTE_LABEL } from "../lib/theme";
import { go } from "../lib/router";
import { FamChip } from "./ui";
import { useTooltip } from "./Tooltip";
import type { Deputy } from "../lib/types";

export interface Seat {
  dep: Deputy;
  fam: string;
  vote: string; // P C A N .
}

const VOTE_ORDER: Record<string, number> = { P: 0, A: 1, C: 2, N: 3, ".": 4 };

/** Disposition des sièges : rangées concentriques, sièges triés par angle (de gauche à droite). */
function layout(n: number) {
  const rows = Math.max(4, Math.round(Math.sqrt(n / 4.2)));
  const r0 = 0.36;
  const radii = Array.from({ length: rows }, (_, i) => r0 + ((1 - r0) * i) / (rows - 1));
  const total = radii.reduce((a, r) => a + r, 0);
  const counts = radii.map((r) => Math.floor((n * r) / total));
  let rest = n - counts.reduce((a, c) => a + c, 0);
  for (let i = rows - 1; rest > 0; i = (i - 1 + rows) % rows, rest--) counts[i]++;
  const seats: { x: number; y: number; a: number; row: number }[] = [];
  radii.forEach((r, i) => {
    const c = counts[i];
    for (let j = 0; j < c; j++) {
      const a = Math.PI * (1 - (j + 0.5) / c);
      seats.push({ x: r * Math.cos(a), y: r * Math.sin(a), a, row: i });
    }
  });
  seats.sort((p, q) => q.a - p.a || p.row - q.row);
  const seatR = ((1 - r0) / (rows - 1)) * 0.36;
  return { seats, seatR };
}

export function Hemicycle({ seats, colorBy = "vote" }: { seats: Seat[]; colorBy?: "vote" | "fam" }) {
  const core = useCore();
  const tt = useTooltip();
  const famOrder = React.useMemo(() => {
    const o: Record<string, number> = {};
    core.meta.families.forEach((f, i) => (o[f.id] = i));
    return o;
  }, [core]);
  const ordered = React.useMemo(
    () =>
      [...seats].sort(
        (a, b) =>
          famOrder[a.fam] - famOrder[b.fam] ||
          (VOTE_ORDER[a.vote] ?? 9) - (VOTE_ORDER[b.vote] ?? 9) ||
          a.dep.nom.localeCompare(b.dep.nom, "fr"),
      ),
    [seats, famOrder],
  );
  const { seats: pos, seatR } = React.useMemo(() => layout(ordered.length), [ordered.length]);
  const W = 1000,
    R = 400,
    H = R + 70,
    cx = W / 2,
    cy = H - 14;
  // Étiquettes des groupes autour de l'arc, à l'angle moyen de leurs sièges.
  const labels = React.useMemo(() => {
    const acc = new Map<string, { sum: number; n: number }>();
    ordered.forEach((st, k) => {
      const p = pos[k];
      if (!p) return;
      const a = acc.get(st.fam) ?? { sum: 0, n: 0 };
      a.sum += p.a;
      a.n += 1;
      acc.set(st.fam, a);
    });
    const out: { fam: string; x: number; y: number; anchor: "start" | "middle" | "end"; n: number }[] = [];
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    for (const [fam, { sum, n }] of acc) {
      const a = sum / n;
      const rr = R + 22;
      const x = cx + rr * Math.cos(a);
      let y = cy - rr * Math.sin(a) + 5;
      const anchor = a > Math.PI / 2 + 0.2 ? "end" : a < Math.PI / 2 - 0.2 ? "start" : "middle";
      const text = `${core.famById[fam]?.short ?? fam} ${n}`;
      const w = text.length * 8.2;
      const bx = (yy: number) => ({
        x0: anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x,
        x1: anchor === "end" ? x : anchor === "middle" ? x + w / 2 : x + w,
        y0: yy - 15,
        y1: yy + 3,
      });
      let b = bx(y);
      for (let k = 0; k < 8 && placed.some((q) => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0); k++) {
        y -= 17;
        b = bx(y);
      }
      placed.push(b);
      out.push({ fam, x, y, anchor, n });
    }
    return out;
  }, [ordered, pos, core]);
  return (
    <div className="hemi">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Hémicycle : vote de chaque député">
        {labels.map((l) => (
          <text
            key={l.fam}
            x={l.x}
            y={l.y}
            textAnchor={l.anchor}
            style={{ fill: "var(--ink-2)", fontSize: 15, fontWeight: 650, fontFamily: "var(--font-body)" }}
          >
            {core.famById[l.fam]?.short ?? l.fam} <tspan style={{ fill: "var(--muted)", fontWeight: 400 }}>{l.n}</tspan>
          </text>
        ))}
        {ordered.map((s, k) => {
          const p = pos[k];
          if (!p) return null;
          const fill = colorBy === "fam" ? famColor(s.fam) : VOTE_COLOR[s.vote];
          const absent = colorBy === "vote" && s.vote === ".";
          return (
            <circle
              key={s.dep.id}
              cx={cx + p.x * R}
              cy={cy - p.y * R}
              r={seatR * R}
              style={{
                fill: absent ? "transparent" : fill,
                stroke: absent ? "var(--line-2)" : "var(--surface)",
                strokeWidth: absent ? 1.2 : 1,
                cursor: "pointer",
              }}
              onPointerMove={(e) => {
                if (e.pointerType === "touch") return;
                tt.show(
                  e.clientX,
                  e.clientY,
                  <div>
                    <div className="tv">
                      {s.dep.prenom} {s.dep.nom}
                    </div>
                    <div>
                      <FamChip id={s.fam} long />
                    </div>
                    <hr />
                    <div>{VOTE_LABEL[s.vote]}</div>
                  </div>,
                );
              }}
              onPointerLeave={() => tt.hide()}
              onClick={() => go({ page: "depute", id: s.dep.id })}
            />
          );
        })}
      </svg>
    </div>
  );
}
