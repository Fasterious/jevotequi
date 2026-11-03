import React from "react";
import { loadCensures, loadDeputies, useAsync, useCore } from "../lib/data";
import { agree, selectIdx } from "../lib/stats";
import { fmtDate, fmtInt, fmtPct } from "../lib/format";
import { href } from "../lib/router";
import { famColor } from "../lib/theme";
import { AgreementTip, RampLegend, RankBars } from "../components/charts";
import { Avatar, ErrorBox, FamChip, Loading, ScopeBar, useScope } from "../components/ui";
import { Facts, KeyVotes, Multiples, scopeLabel, ThemeBlock } from "./Home";

export function Groupe({ id }: { id: string }) {
  const core = useCore();
  const f = core.famById[id];
  const [scope] = useScope();
  const deps = useAsync(loadDeputies, []);
  const cens = useAsync(loadCensures, []);
  const idx = React.useMemo(() => selectIdx(core, scope), [core, scope]);
  const others = core.posFams.filter((x) => x !== id && !(scope.leg === 16 && x === "UDR"));
  const ags = React.useMemo(
    () => (f?.hasPosition ? others.map((o) => ({ o, ag: agree(core.famVec[o], core.famVec[id], idx) })) : []),
    [core, id, idx, others.join(), f],
  );
  if (!f)
    return (
      <div className="wrap page">
        <p>Groupe inconnu.</p>
      </div>
    );
  const sl = scopeLabel(core, scope);
  const members = deps.data ? deps.data.list.filter((d) => d.legs["17"] && !d.legs["17"].to && d.legs["17"].fam === id) : [];
  const loyalAgg = members.reduce((a, d) => [a[0] + d.legs["17"].loyal[0], a[1] + d.legs["17"].loyal[1]], [0, 0]);
  const cs = cens.data?.filter((c) => c.fam[id] && c.fam[id][1] > 0) ?? [];
  const supported = cs.filter((c) => c.fam[id][0] * 2 > c.fam[id][1]);

  return (
    <div className="wrap page">
      <div className="stack" style={{ gap: "1.2rem" }}>
        <div className="stack" style={{ gap: "0.5rem" }}>
          <span className="eyebrow">Groupe politique</span>
          <h1 style={{ fontSize: "var(--step-4)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ width: "0.6em", height: "0.6em", borderRadius: "50%", background: famColor(id), display: "inline-block" }} />
            {f.name}
          </h1>
          <p className="lead">{f.desc}.</p>
          <div className="row small ink2">
            {f.groups.map((g) => (
              <span key={g.uid} className="badge">
                {g.leg}e · {g.label} ({g.abbr}){g.to ? ` · jusqu'au ${fmtDate(g.to)}` : ""}
              </span>
            ))}
          </div>
        </div>

        {deps.data && members.length > 0 && (
          <div className="tiles">
            <div className="tile">
              <span className="k">Députés aujourd'hui</span>
              <span className="v">{fmtInt(members.length)}</span>
              <span className="s">membres et apparentés en fonction</span>
            </div>
            <div className="tile">
              <span className="k">Unité du groupe</span>
              <span className="v">{fmtPct(loyalAgg[1] ? loyalAgg[0] / loyalAgg[1] : null)}</span>
              <span className="s">des votes de ses membres suivent la position du groupe (depuis 2024)</span>
            </div>
            {cs.length > 0 && (
              <div className="tile">
                <span className="k">Motions de censure votées</span>
                <span className="v">
                  {supported.length} <span className="small muted">sur {cs.length}</span>
                </span>
                <span className="s">votées par la majorité du groupe</span>
              </div>
            )}
          </div>
        )}

        {f.hasPosition && (
          <>
            <ScopeBar count={idx.length} showGov showTheme />
            <div className="card stack">
              <h2 className="card-title">Avec qui vote {f.short} ?</h2>
              <p className="small ink2">Part des scrutins où chaque groupe a pris la même position que {f.name}{sl ? ` — ${sl}` : ""}.</p>
              <RankBars
                rows={ags.map(({ o, ag }) => ({
                  id: o,
                  dot: o,
                  label: core.famById[o].short,
                  ag,
                  link: href({ page: "compare", a: o, b: id }),
                  tip: () => <AgreementTip a={<FamChip id={o} />} b={<FamChip id={id} />} ag={ag} scopeLabel={sl} />,
                }))}
              />
              <Facts refFam={id} scope={scope} others={others} />
            </div>
            <div className="card stack">
              <h2 className="card-title">Au fil du temps</h2>
              <p className="small ink2">Accord de chaque groupe avec {f.short}, trimestre par trimestre.</p>
              <Multiples refFam={id} fams={others} idx={idx} />
            </div>
            <div className="card stack">
              <h2 className="card-title">Sujet par sujet</h2>
              <ThemeBlock refFam={id} fams={others} idx={idx} />
              <RampLegend label={`Part des scrutins du thème où le groupe a voté comme ${f.short}`} />
            </div>
            <div className="card stack">
              <h2 className="card-title">Les grands votes</h2>
              <KeyVotes scope={scope} />
            </div>
          </>
        )}

        <div className="card stack">
          <h2 className="card-title">Les députés du groupe aujourd'hui</h2>
          {deps.error && <ErrorBox error={deps.error} />}
          {!deps.data && !deps.error && <Loading />}
          {deps.data && (
            <>
              <p className="small ink2">Triés du plus indépendant au plus fidèle à la position du groupe.</p>
              <div className="dep-grid">
                {[...members]
                  .sort((a, b) => {
                    const la = a.legs["17"].loyal,
                      lb = b.legs["17"].loyal;
                    return (la[1] ? la[0] / la[1] : 1) - (lb[1] ? lb[0] / lb[1] : 1);
                  })
                  .map((d) => {
                    const L = d.legs["17"];
                    return (
                      <a key={d.id} className="dep-card" href={href({ page: "depute", id: d.id })}>
                        <Avatar prenom={d.prenom} nom={d.nom} fam={L.fam} />
                        <span style={{ minWidth: 0 }}>
                          <span className="nm">
                            {d.prenom} {d.nom}
                          </span>
                          <br />
                          <span className="meta num">
                            Avec son groupe : {fmtPct(L.loyal[1] ? L.loyal[0] / L.loyal[1] : null)} · {fmtInt(L.votes)} votes
                          </span>
                        </span>
                      </a>
                    );
                  })}
              </div>
              {members.length === 0 && <p className="muted">Ce groupe n'existe plus dans l'Assemblée actuelle.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
