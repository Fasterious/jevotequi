import React from "react";
import { deputyVector, fold, legVectors, loadDeputies, useAsync, useCore, type DeputyIndex } from "../lib/data";
import { fmtDate, fmtInt, fmtPct, deputyTitle } from "../lib/format";
import { href } from "../lib/router";
import { famPos, isVote } from "../lib/stats";
import { RankBars } from "../components/charts";
import { ScrutinList } from "../components/ScrutinList";
import { Avatar, ErrorBox, FamChip, Loading, Segmented, VotePill } from "../components/ui";
import type { Deputy } from "../lib/types";

export function DeputePage({ id }: { id: string }) {
  const deps = useAsync(loadDeputies, []);
  if (deps.error)
    return (
      <div className="wrap page">
        <ErrorBox error={deps.error} />
      </div>
    );
  if (!deps.data) return <Loading label="Chargement du député…" />;
  const d = deps.data.byId.get(id);
  if (!d)
    return (
      <div className="wrap page">
        <p>
          Député introuvable. <a href={href({ page: "deputes" })}>Voir la liste des députés</a>.
        </p>
      </div>
    );
  return <DeputeView key={id} d={d} deps={deps.data} />;
}

type VoteFilter = "all" | "rebel" | "P" | "C" | "A";

function DeputeView({ d, deps }: { d: Deputy; deps: DeputyIndex }) {
  const core = useCore();
  const legs = Object.keys(d.legs).map(Number).sort();
  const [leg, setLeg] = React.useState(legs[legs.length - 1]);
  const L = d.legs[String(leg)];
  const vec = useAsync(() => deputyVector(core, d), [d.id]);
  const [filter, setFilter] = React.useState<VoteFilter>("all");
  const [q, setQ] = React.useState("");
  const title = deputyTitle(d.civ);
  const part = L.elig ? L.votes / L.elig : null;
  const loyal = L.loyal[1] ? L.loyal[0] / L.loyal[1] : null;
  const famHistory = L.hist.length > 1 ? L.hist : null;

  const famAtIdx = React.useCallback(
    (i: number) => {
      const num = core.s.num[i];
      let f = L.hist.length ? L.hist[0][1] : L.fam;
      for (const [n, fam] of L.hist) {
        if (n <= num) f = fam;
        else break;
      }
      return f;
    },
    [L, core],
  );

  const items = React.useMemo(() => {
    if (!vec.data) return [];
    const v = vec.data;
    const qq = fold(q.trim());
    const out: number[] = [];
    for (let i = core.N - 1; i >= 0; i--) {
      if (core.s.leg[i] !== leg) continue;
      const c = v[i];
      if (!isVote(c)) continue;
      const ch = String.fromCharCode(c);
      if (filter === "rebel") {
        const gp = famPos(core, famAtIdx(i), i);
        if (!"PCA".includes(gp) || gp === ch) continue;
      } else if (filter !== "all" && ch !== filter) continue;
      if (qq.length >= 2 && !core.searchText[i].includes(qq)) continue;
      out.push(i);
    }
    return out;
  }, [vec.data, core, leg, filter, q, famAtIdx]);

  const lastFam = L.fam;
  React.useEffect(() => {
    document.title = `${d.prenom} ${d.nom} · Je vote qui ?`;
  }, [d]);
  return (
    <div className="wrap page">
      <div className="stack" style={{ gap: "1.2rem" }}>
        <div className="row" style={{ gap: "1rem", alignItems: "center", flexWrap: "nowrap" }}>
          <Avatar prenom={d.prenom} nom={d.nom} fam={lastFam} xl />
          <div className="stack" style={{ gap: "0.3rem", minWidth: 0 }}>
            <span className="eyebrow">{title === "députée" ? "Députée" : "Député"}</span>
            <h1 style={{ fontSize: "var(--step-3)" }}>
              {d.prenom} {d.nom}
            </h1>
            <div className="row small ink2">
              <FamChip id={lastFam} long link />
              {L.dept && (
                <span>
                  · {L.dept}
                  {L.circo ? `, ${L.circo}${L.circo === "1" ? "re" : "e"} circonscription` : ""}
                </span>
              )}
              {d.party && <span>· parti de rattachement : {d.party}</span>}
            </div>
          </div>
        </div>

        <div className="row">
          {legs.length > 1 && (
            <Segmented<number>
              label="Législature"
              value={leg}
              onChange={setLeg}
              options={legs.map((l) => ({ value: l, label: l === 16 ? "2022-2024" : "Depuis 2024" }))}
            />
          )}
          <span className="small muted">
            Mandat {L.from ? `du ${fmtDate(L.from)}` : ""}
            {L.to ? ` au ${fmtDate(L.to)}` : " (en cours)"}
            {L.fin ? ` · fin : ${L.fin.toLowerCase()}` : ""}
          </span>
          <a className="btn" href={`https://www.assemblee-nationale.fr/dyn/deputes/${d.id}`} target="_blank" rel="noopener noreferrer">
            Fiche officielle ↗
          </a>
          <a className="btn" href={href({ page: "compare", a: d.id, b: lastFam === "NI" ? undefined : lastFam })}>
            Comparer
          </a>
        </div>

        {famHistory && (
          <p className="small">
            A changé de groupe pendant la législature :{" "}
            {famHistory.map(([num, f], k) => (
              <span key={num}>
                {k > 0 && " → "}
                <FamChip id={f} /> <span className="muted">(dès le scrutin n° {num})</span>
              </span>
            ))}
          </p>
        )}

        <div className="tiles">
          <div className="tile">
            <span className="k">Scrutins où {title === "députée" ? "elle" : "il"} a voté</span>
            <span className="v">{fmtPct(part)}</span>
            <span className="s">
              {fmtInt(L.votes)} sur {fmtInt(L.elig)} pendant son mandat
            </span>
          </div>
          <div className="tile">
            <span className="k">A voté comme son groupe</span>
            <span className="v">{fmtPct(loyal)}</span>
            <span className="s">{L.loyal[1] ? `${fmtInt(L.loyal[1] - L.loyal[0])} votes différents de son groupe` : "Non-inscrit : pas de position de groupe"}</span>
          </div>
          <div className="tile">
            <span className="k">Répartition de ses votes</span>
            <span className="v" style={{ fontSize: "var(--step-1)" }}>
              {fmtInt(L.p)} pour · {fmtInt(L.c)} contre
            </span>
            <span className="s">{fmtInt(L.a)} abstentions</span>
          </div>
          <div className="tile">
            <span className="k">Motions de censure votées</span>
            <span className="v">{fmtInt(L.cens)}</span>
            <span className="s">pendant cette législature</span>
          </div>
        </div>

        <div className="grid-2">
          <div className="card stack">
            <h2 className="card-title">Avec quels groupes vote-t-{title === "députée" ? "elle" : "il"} ?</h2>
            <p className="small ink2">Part de ses votes identiques à la position de chaque groupe.</p>
            <RankBars
              rows={core.posFams
                .map((f, k) => ({ f, ag: { same: L.agree[k][0], total: L.agree[k][1], opp: 0, partial: 0 } }))
                .filter((x) => x.ag.total > 0)
                .map(({ f, ag }) => ({
                  id: f,
                  dot: f,
                  label: core.famById[f].short,
                  ag,
                  link: href({ page: "compare", a: d.id, b: f }),
                  tip: () => (
                    <div>
                      <div className="tv">{fmtPct(ag.same / ag.total)}</div>
                      <div>
                        {d.prenom} {d.nom} a voté comme le groupe {core.famById[f].short} {fmtInt(ag.same)} fois sur {fmtInt(ag.total)}.
                      </div>
                    </div>
                  ),
                }))}
            />
          </div>
          <div className="card stack">
            <h2 className="card-title">Les députés qui votent le plus comme {title === "députée" ? "elle" : "lui"}, hors de son groupe</h2>
            <Neighbours d={d} leg={leg} deps={deps} />
          </div>
        </div>

        <div className="card stack">
          <h2 className="card-title">Ses votes</h2>
          {vec.error && <ErrorBox error={vec.error} />}
          {!vec.data && !vec.error && <Loading />}
          {vec.data && (
            <>
              <div className="row">
                <Segmented<VoteFilter>
                  label="Filtrer ses votes"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "all", label: "Tous" },
                    { value: "rebel", label: "Contre l'avis de son groupe" },
                    { value: "P", label: "Pour" },
                    { value: "C", label: "Contre" },
                    { value: "A", label: "Abstention" },
                  ]}
                />
                <input className="input" type="search" id="dep-q" placeholder="Mot-clé" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: "18rem" }} />
                <span className="small muted num">{fmtInt(items.length)} votes</span>
              </div>
              <ScrutinList
                items={items}
                showStrip={false}
                right={(i) => {
                  const f = famAtIdx(i);
                  const gp = famPos(core, f, i);
                  return (
                    <span className="pair-cells">
                      <span>
                        <span className="muted tiny">{d.nom}</span>
                        <br />
                        <VotePill c={String.fromCharCode(vec.data![i])} />
                      </span>
                      <span>
                        <span className="muted tiny">Son groupe</span>
                        <br />
                        <VotePill c={gp} />
                      </span>
                    </span>
                  );
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Neighbours({ d, leg, deps }: { d: Deputy; leg: number; deps: DeputyIndex }) {
  const core = useCore();
  const L = d.legs[String(leg)];
  const res = useAsync(async () => {
    const all = await legVectors(core, leg);
    const me = all.v[L.i];
    const cens = new Set<number>();
    const map = core.legIdx[leg];
    for (let j = 0; j < map.length; j++) if (core.kindIds[core.s.kind[map[j]]] === "censure") cens.add(j);
    const out: { dep: Deputy; same: number; total: number }[] = [];
    all.v.forEach((v, k) => {
      if (k === L.i) return;
      const other = deps.byLeg[leg][k];
      if (!other) return;
      const OL = other.legs[String(leg)];
      if (OL.fam === L.fam) return;
      let same = 0,
        total = 0;
      for (let j = 0; j < v.length; j++) {
        if (cens.has(j)) continue;
        const a = me.charCodeAt(j),
          b = v.charCodeAt(j);
        if (isVote(a) && isVote(b)) {
          total++;
          if (a === b) same++;
        }
      }
      if (total >= 80) out.push({ dep: other, same, total });
    });
    out.sort((x, y) => y.same / y.total - x.same / x.total);
    return out.slice(0, 8);
  }, [d.id, leg]);
  if (res.error) return <ErrorBox error={res.error} />;
  if (!res.data) return <Loading label="Calcul en cours…" />;
  if (!res.data.length) return <p className="muted">Pas assez de votes en commun pour comparer.</p>;
  return (
    <div className="stack" style={{ gap: "0.25rem" }}>
      {res.data.map((x) => {
        const OL = x.dep.legs[String(leg)];
        return (
          <a key={x.dep.id} className="spread" href={href({ page: "compare", a: d.id, b: x.dep.id })} style={{ textDecoration: "none", padding: "0.35rem 0", borderBottom: "1px solid var(--line)" }}>
            <span className="row" style={{ gap: "0.5rem", flexWrap: "nowrap", minWidth: 0 }}>
              <Avatar prenom={x.dep.prenom} nom={x.dep.nom} fam={OL.fam} />
              <span style={{ minWidth: 0 }}>
                <strong>
                  {x.dep.prenom} {x.dep.nom}
                </strong>
                <br />
                <span className="small muted">
                  <FamChip id={OL.fam} />
                </span>
              </span>
            </span>
            <span className="num" style={{ fontWeight: 700 }}>
              {fmtPct(x.same / x.total)} <span className="small muted">({fmtInt(x.total)})</span>
            </span>
          </a>
        );
      })}
      <p className="note">Part de votes identiques sur les scrutins où les deux ont voté (au moins 80 en commun). Cliquez pour comparer.</p>
    </div>
  );
}
