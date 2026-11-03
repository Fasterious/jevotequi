import React from "react";
import { deputyVector, fold, loadDeputies, useAsync, useCore, type DeputyIndex } from "../lib/data";
import { groupeAuHasard } from "../lib/hasard";
import { agree, byField, isDeputyId, isVote, rate, selectIdx, series } from "../lib/stats";
import { fmtInt, fmtPct } from "../lib/format";
import { go } from "../lib/router";
import { EntityPicker } from "../components/EntityPicker";
import { SimpleBars, TimeChart } from "../components/charts";
import { ScrutinList } from "../components/ScrutinList";
import { ErrorBox, FamChip, Loading, ScopeBar, Segmented, ShareButton, useScope, VotePill } from "../components/ui";
import { scopeLabel } from "./Home";

function useVector(id: string, deps: DeputyIndex | undefined): Uint8Array | null | Error {
  const core = useCore();
  const [v, setV] = React.useState<Uint8Array | null | Error>(null);
  React.useEffect(() => {
    let alive = true;
    if (!isDeputyId(id)) {
      setV(core.famVec[id] ?? new Error(`Groupe inconnu : ${id}`));
      return;
    }
    setV(null);
    if (!deps) return;
    const d = deps.byId.get(id);
    if (!d) {
      setV(new Error(`Député inconnu : ${id}`));
      return;
    }
    deputyVector(core, d).then(
      (x) => alive && setV(x),
      (e) => alive && setV(e),
    );
    return () => {
      alive = false;
    };
  }, [id, deps, core]);
  return v;
}

export function entityName(core: ReturnType<typeof useCore>, id: string, deps: DeputyIndex | undefined): string {
  if (isDeputyId(id)) {
    const d = deps?.byId.get(id);
    return d ? `${d.prenom} ${d.nom}` : "…";
  }
  return core.famById[id]?.short ?? id;
}

function EntityLabel({ id, deps }: { id: string; deps: DeputyIndex | undefined }) {
  const core = useCore();
  if (!isDeputyId(id)) return <FamChip id={id} />;
  const d = deps?.byId.get(id);
  if (!d) return <span>…</span>;
  const legs = Object.keys(d.legs);
  return (
    <span className="chip">
      <span className="dot" style={{ background: `var(--f-${d.legs[legs[legs.length - 1]].fam})` }} />
      {d.prenom} {d.nom}
    </span>
  );
}

type Tab = "same" | "opp" | "partial" | "all";

export function Compare({ a, b }: { a?: string; b?: string }) {
  const core = useCore();
  const deps = useAsync(loadDeputies, []);
  // Sans paire demandée, deux groupes tirés au hasard : aucune comparaison n'est mise en avant par défaut.
  const A = a && (core.famVec[a] || isDeputyId(a)) ? a : groupeAuHasard(core.posFams, "qvq-comparer-a");
  const B = b && (core.famVec[b] || isDeputyId(b)) ? b : groupeAuHasard(core.posFams, "qvq-comparer-b", A);
  const [scope] = useScope();
  const idx = React.useMemo(() => selectIdx(core, scope), [core, scope]);
  const va = useVector(A, deps.data);
  const vb = useVector(B, deps.data);
  const [tab, setTab] = React.useState<Tab>("opp");
  const [q, setQ] = React.useState("");
  const [sortImp, setSortImp] = React.useState(true);
  const nameA = entityName(core, A, deps.data);
  const nameB = entityName(core, B, deps.data);
  const sl = scopeLabel(core, scope);

  const ready = va instanceof Uint8Array && vb instanceof Uint8Array;
  const stats = React.useMemo(() => {
    if (!ready) return null;
    const ag = agree(va, vb, idx);
    const kinds = byField(core, "kind", va, vb, idx);
    const themes = byField(core, "theme", va, vb, idx);
    const pts = series(core, va, vb, idx);
    const legs = [16, 17].map((l) => ({ l, ag: agree(va, vb, Array.from(idx).filter((i) => core.s.leg[i] === l)) }));
    const lists: Record<Tab, number[]> = { same: [], opp: [], partial: [], all: [] };
    for (let k = idx.length - 1; k >= 0; k--) {
      const i = idx[k];
      const x = va[i],
        y = vb[i];
      if (!isVote(x) || !isVote(y)) continue;
      lists.all.push(i);
      if (x === y) lists.same.push(i);
      else if (x === 65 || y === 65) lists.partial.push(i);
      else lists.opp.push(i);
    }
    return { ag, kinds, themes, pts, legs, lists };
  }, [ready, va, vb, idx, core]);

  const setA = (v: string) => go({ page: "compare", a: v, b: B });
  const setB = (v: string) => go({ page: "compare", a: A, b: v });

  const items = React.useMemo(() => {
    if (!stats) return [];
    const base = stats.lists[tab];
    const qq = fold(q.trim());
    const f = qq.length >= 2 ? base.filter((i) => core.searchText[i].includes(qq)) : base;
    if (!sortImp) return f;
    // Les votes les plus importants d'abord : solennels, votes finaux et censures, puis le reste.
    const weight: Record<string, number> = { ensemble: 3, partie: 3, censure: 3, confiance: 3, declaration: 2, motion: 2, article: 1, resolution: 1 };
    const w = (i: number) => (core.s.solemn[i] ? 4 : 0) + (weight[core.kindIds[core.s.kind[i]]] ?? 0);
    return [...f].sort((x, y) => w(y) - w(x) || y - x);
  }, [stats, tab, q, core, sortImp]);

  return (
    <div className="wrap page">
      <div className="stack" style={{ gap: "1.2rem" }}>
        <div className="section-head">
          <span className="eyebrow">Comparateur</span>
          <h1 style={{ fontSize: "var(--step-3)" }}>Comparer deux votes</h1>
          <p>Choisissez deux groupes, deux députés, ou un député et un groupe.</p>
        </div>
        <div className="versus">
          <EntityPicker id="pick-a" label="Premier" value={A} onChange={setA} deps={deps.data} />
          <button type="button" className="btn" onClick={() => go({ page: "compare", a: B, b: A })} aria-label="Inverser">
            ⇄
          </button>
          <EntityPicker id="pick-b" label="Second" value={B} onChange={setB} deps={deps.data} />
        </div>
        <ScopeBar count={idx.length} showTheme showGov />
        {deps.error && <ErrorBox error={deps.error} />}
        {va instanceof Error && <ErrorBox error={va} />}
        {vb instanceof Error && <ErrorBox error={vb} />}
        {!stats && !(va instanceof Error) && !(vb instanceof Error) && <Loading />}
        {stats && (
          <>
            <div className="card stack">
              {stats.ag.total === 0 ? (
                <p className="headline">
                  Aucun scrutin où {nameA} et {nameB} ont tous deux voté{sl ? ` (${sl})` : ""}.
                </p>
              ) : (
                <>
                  <p className="headline">
                    <EntityLabel id={A} deps={deps.data} /> et <EntityLabel id={B} deps={deps.data} /> ont voté de la même façon dans{" "}
                    <mark>{fmtPct(rate(stats.ag))}</mark> des scrutins.
                  </p>
                  <p className="ink2">
                    {fmtInt(stats.ag.same)} votes identiques sur {fmtInt(stats.ag.total)} scrutins où les deux ont pris position
                    {sl ? ` (${sl})` : ""}. Position opposée (l'un pour, l'autre contre) : {fmtInt(stats.ag.opp)} fois. L'un s'est abstenu, pas l'autre :{" "}
                    {fmtInt(stats.ag.partial)} fois.
                  </p>
                  <SegBar ag={stats.ag} />
                  <div className="row">
                    <ShareButton
                      text={`${nameA} et ${nameB} ont voté de la même façon dans ${fmtPct(rate(stats.ag))} des scrutins à l'Assemblée nationale (${fmtInt(
                        stats.ag.same,
                      )} sur ${fmtInt(stats.ag.total)}${sl ? `, ${sl}` : ""}). Chaque vote est vérifiable :`}
                    />
                    {stats.legs.map(
                      (x) =>
                        x.ag.total > 0 &&
                        !scope.leg && (
                          <span key={x.l} className="badge">
                            {x.l === 16 ? "2022-2024" : "Depuis 2024"} : {fmtPct(rate(x.ag))}
                          </span>
                        ),
                    )}
                  </div>
                </>
              )}
            </div>

            {stats.ag.total > 0 && (
              <div className="grid-2">
                <div className="card stack">
                  <h2 className="card-title">Par thème</h2>
                  <SimpleBars
                    rows={core.meta.themes
                      .map((t, k) => ({ key: t.id, label: t.label, ag: stats.themes[k] }))
                      .filter((r) => r.ag.total >= 10)
                      .sort((x, y) => rate(y.ag)! - rate(x.ag)!)}
                  />
                  <p className="note">Thèmes comptant au moins 10 scrutins communs. Le second nombre est le nombre de scrutins.</p>
                </div>
                <div className="card stack">
                  <h2 className="card-title">Par type de vote</h2>
                  <SimpleBars
                    rows={core.meta.kinds
                      .map((t, k) => ({ key: t.id, label: t.label, ag: stats.kinds[k] }))
                      .filter((r) => r.ag.total >= 5)
                      .sort((x, y) => y.ag.total - x.ag.total)}
                  />
                  <h2 className="card-title" style={{ marginTop: "0.8rem" }}>
                    Dans le temps
                  </h2>
                  <TimeChart points={stats.pts} label={`Accord entre ${nameA} et ${nameB} par trimestre`} />
                  <p className="note">Part des votes identiques par trimestre (au moins 15 scrutins communs). Bandes : gouvernements successifs.</p>
                </div>
              </div>
            )}

            {stats.ag.total > 0 && (
              <div className="card stack">
                <h2 className="card-title">Les votes, un par un</h2>
                <div className="tabs" role="tablist" aria-label="Filtrer les votes">
                  {(
                    [
                      ["opp", `Votes opposés (${fmtInt(stats.lists.opp.length)})`],
                      ["same", `Votes identiques (${fmtInt(stats.lists.same.length)})`],
                      ["partial", `L'un s'abstient (${fmtInt(stats.lists.partial.length)})`],
                      ["all", `Tous (${fmtInt(stats.lists.all.length)})`],
                    ] as [Tab, string][]
                  ).map(([k, l]) => (
                    <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                      {l}
                    </button>
                  ))}
                </div>
                <div className="row" style={{ flexWrap: "wrap" }}>
                  <input
                    className="input"
                    type="search"
                    id="compare-search"
                    placeholder="Filtrer par mot-clé (ex. retraites, immigration, SMIC…)"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    style={{ flex: "1 1 18rem" }}
                  />
                  <Segmented<string>
                    label="Ordre"
                    value={sortImp ? "imp" : "date"}
                    onChange={(v) => setSortImp(v === "imp")}
                    options={[
                      { value: "imp", label: "Votes importants d'abord" },
                      { value: "date", label: "Plus récents" },
                    ]}
                  />
                </div>
                <ScrutinList
                  items={items}
                  showStrip={false}
                  right={(i) => (
                    <span className="pair-cells">
                      <span>
                        <span className="muted tiny">{nameA}</span>
                        <br />
                        <VotePill c={String.fromCharCode((va as Uint8Array)[i])} />
                      </span>
                      <span>
                        <span className="muted tiny">{nameB}</span>
                        <br />
                        <VotePill c={String.fromCharCode((vb as Uint8Array)[i])} />
                      </span>
                    </span>
                  )}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SegBar({ ag }: { ag: { same: number; opp: number; partial: number; total: number } }) {
  const parts = [
    { k: "Même vote", v: ag.same, c: "var(--agree)", ink: "var(--surface)" },
    { k: "L'un s'abstient", v: ag.partial, c: "var(--partial)", ink: "var(--ink)" },
    { k: "Votes opposés", v: ag.opp, c: "var(--oppose)", ink: "#12141a" },
  ];
  return (
    <div className="stack" style={{ gap: "0.4rem" }}>
      <div className="segbar" role="img" aria-label={parts.map((p) => `${p.k} : ${fmtPct(p.v / ag.total)}`).join(", ")}>
        {parts.map((p) =>
          p.v > 0 ? (
            <div key={p.k} style={{ flexGrow: p.v, flexBasis: 0, background: p.c, color: p.ink }} title={`${p.k} : ${fmtPct(p.v / ag.total)}`}>
              {p.v / ag.total >= 0.09 ? fmtPct(p.v / ag.total) : ""}
            </div>
          ) : null,
        )}
      </div>
      <div className="legend">
        {parts.map((p) => (
          <span key={p.k}>
            <span className="sw" style={{ background: p.c }} />
            {p.k} · {fmtPct(p.v / ag.total)}
          </span>
        ))}
      </div>
    </div>
  );
}
