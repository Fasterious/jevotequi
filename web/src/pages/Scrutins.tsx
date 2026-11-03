import React from "react";
import { fold, useCore } from "../lib/data";
import { fmtInt } from "../lib/format";
import { ScrutinList } from "../components/ScrutinList";
import { Segmented, VoteLegend } from "../components/ui";

interface Cond {
  fam: string;
  pos: string; // P C A
}

export function Scrutins() {
  const core = useCore();
  const [q, setQ] = React.useState("");
  const [leg, setLeg] = React.useState(0);
  const [kind, setKind] = React.useState(-1);
  const [theme, setTheme] = React.useState(-1);
  const [result, setResult] = React.useState<"" | "1" | "0">("");
  const [solemn, setSolemn] = React.useState(false);
  const [contested, setContested] = React.useState(false);
  const [conds, setConds] = React.useState<Cond[]>([
    { fam: "", pos: "P" },
    { fam: "", pos: "C" },
  ]);
  const [order, setOrder] = React.useState<"desc" | "asc">("desc");

  const items = React.useMemo(() => {
    const qq = fold(q.trim());
    const words = qq.split(/\s+/).filter((w) => w.length >= 2);
    const active = conds.filter((c) => c.fam);
    const out: number[] = [];
    const { s } = core;
    for (let i = 0; i < core.N; i++) {
      if (leg && s.leg[i] !== leg) continue;
      if (kind >= 0 && s.kind[i] !== kind) continue;
      if (theme >= 0 && s.theme[i] !== theme) continue;
      if (result && String(s.adopted[i]) !== result) continue;
      if (solemn && !s.solemn[i]) continue;
      if (contested && !core.contested[i]) continue;
      if (active.some((c) => s.pos[i][core.posIndex[c.fam]] !== c.pos)) continue;
      if (words.length && !words.every((w) => core.searchText[i].includes(w))) continue;
      out.push(i);
    }
    return order === "desc" ? out.reverse() : out;
  }, [core, q, leg, kind, theme, result, solemn, contested, conds, order]);

  const setCond = (k: number, patch: Partial<Cond>) => setConds(conds.map((c, j) => (j === k ? { ...c, ...patch } : c)));

  return (
    <div className="wrap page">
      <div className="stack" style={{ gap: "1.2rem" }}>
        <div className="section-head">
          <span className="eyebrow">Explorer</span>
          <h1 style={{ fontSize: "var(--step-3)" }}>Tous les scrutins publics</h1>
          <p>
            {fmtInt(core.N)} votes depuis juillet 2022. Cherchez un sujet, filtrez par thème, ou posez une question précise : « les scrutins où le RN a voté pour et
            Renaissance contre ».
          </p>
        </div>
        <div className="card stack">
          <input
            className="input"
            type="search"
            id="scrutins-q"
            placeholder="Mot-clé : retraites, immigration, SMIC, nucléaire, budget 2025…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ fontSize: "1.05rem", padding: "0.65rem 0.9rem" }}
          />
          <div className="row" style={{ gap: "0.6rem 1rem" }}>
            <Segmented<number>
              label="Législature"
              value={leg}
              onChange={setLeg}
              options={[
                { value: 0, label: "Depuis 2022" },
                { value: 16, label: "2022-2024" },
                { value: 17, label: "Depuis 2024" },
              ]}
            />
            <label className="ctl">
              <span>Type</span>
              <select className="select" value={kind} onChange={(e) => setKind(Number(e.target.value))}>
                <option value={-1}>Tous</option>
                {core.meta.kinds.map((k, j) => (
                  <option key={k.id} value={j}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="ctl">
              <span>Thème</span>
              <select className="select" value={theme} onChange={(e) => setTheme(Number(e.target.value))}>
                <option value={-1}>Tous</option>
                {core.meta.themes.map((t, j) => (
                  <option key={t.id} value={j}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="ctl">
              <span>Résultat</span>
              <select className="select" value={result} onChange={(e) => setResult(e.target.value as "" | "1" | "0")}>
                <option value="">Tous</option>
                <option value="1">Adoptés</option>
                <option value="0">Rejetés</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" id="scrutins-solemn" checked={solemn} onChange={(e) => setSolemn(e.target.checked)} />
              Solennels
            </label>
            <label className="check">
              <input type="checkbox" id="scrutins-contested" checked={contested} onChange={(e) => setContested(e.target.checked)} />
              Disputés
            </label>
          </div>
          <div className="row" style={{ gap: "0.5rem 1rem" }}>
            <span className="small ink2">Positions :</span>
            {conds.map((c, k) => (
              <span key={k} className="row" style={{ gap: "0.35rem" }}>
                <select className="select" aria-label={`Groupe ${k + 1}`} value={c.fam} onChange={(e) => setCond(k, { fam: e.target.value })}>
                  <option value="">(un groupe)</option>
                  {core.posFams.map((f) => (
                    <option key={f} value={f}>
                      {core.famById[f].short}
                    </option>
                  ))}
                </select>
                <span className="small">a voté</span>
                <select className="select" aria-label={`Position ${k + 1}`} value={c.pos} onChange={(e) => setCond(k, { pos: e.target.value })}>
                  <option value="P">pour</option>
                  <option value="C">contre</option>
                  <option value="A">abstention</option>
                </select>
                {k === 0 && <span className="small muted">et</span>}
              </span>
            ))}
          </div>
        </div>
        <div className="card stack">
          <div className="spread">
            <strong className="num">{fmtInt(items.length)} scrutins</strong>
            <div className="row">
              <VoteLegend />
              <Segmented<"desc" | "asc">
                label="Ordre"
                value={order}
                onChange={setOrder}
                options={[
                  { value: "desc", label: "Récents" },
                  { value: "asc", label: "Anciens" },
                ]}
              />
            </div>
          </div>
          <ScrutinList items={items} pageSize={40} />
        </div>
      </div>
    </div>
  );
}
