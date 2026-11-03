import React from "react";
import { loadDeputies, loadDetail, useAsync, useCore } from "../lib/data";
import { fmtDate, fmtInt, fmtPct, capitalize } from "../lib/format";
import { href } from "../lib/router";
import { famColor, VOTE_COLOR, VOTE_LABEL } from "../lib/theme";
import { Hemicycle, type Seat } from "../components/Hemicycle";
import { kindShort, ScrutinList } from "../components/ScrutinList";
import { ErrorBox, FamChip, Loading, VoteLegend } from "../components/ui";
import type { Deputy } from "../lib/types";

function famAt(d: Deputy, leg: number, num: number): string {
  const L = d.legs[String(leg)];
  let f = L.hist.length ? L.hist[0][1] : L.fam;
  for (const [n, fam] of L.hist) {
    if (n <= num) f = fam;
    else break;
  }
  return f;
}

export function ScrutinPage({ leg, num }: { leg: number; num: number }) {
  const core = useCore();
  const i = core.byKey.get(`${leg}-${num}`);
  if (i === undefined)
    return (
      <div className="wrap page">
        <p>
          Ce scrutin n'existe pas dans nos données. <a href={href({ page: "scrutins" })}>Voir tous les scrutins</a>.
        </p>
      </div>
    );
  return <ScrutinView key={`${leg}-${num}`} leg={leg} num={num} i={i} />;
}

function ScrutinView({ leg, num, i }: { leg: number; num: number; i: number }) {
  const core = useCore();
  const detail = useAsync(() => loadDetail(core, leg, num), [leg, num]);
  const deps = useAsync(loadDeputies, []);
  const { s, t } = core;
  const date = s.date[i];
  const text = s.text[i] >= 0 ? s.text[i] : -1;
  const kind = core.kindIds[s.kind[i]];
  const d = detail.data;
  const anUrl = `https://www.assemblee-nationale.fr/dyn/${leg}/scrutins/${num}`;

  const seats: Seat[] = React.useMemo(() => {
    if (!d || !deps.data) return [];
    const list = deps.data.byLeg[leg] ?? [];
    const out: Seat[] = [];
    list.forEach((dep, idx) => {
      if (!dep) return;
      const L = dep.legs[String(leg)];
      const vote = d.v[idx] ?? ".";
      const inOffice = (L.per ?? []).some(([a, b]) => a <= date && (!b || b >= date));
      if (vote === "." && !inOffice) return;
      out.push({ dep, fam: famAt(dep, leg, num), vote });
    });
    return out;
  }, [d, deps.data, leg, num, date]);

  const byFamVote = React.useMemo(() => {
    const m = new Map<string, Map<string, Deputy[]>>();
    for (const st of seats) {
      if (st.vote === ".") continue;
      if (!m.has(st.fam)) m.set(st.fam, new Map());
      const mm = m.get(st.fam)!;
      if (!mm.has(st.vote)) mm.set(st.vote, []);
      mm.get(st.vote)!.push(st.dep);
    }
    return m;
  }, [seats]);

  return (
    <div className="wrap page">
      <div className="stack" style={{ gap: "1.2rem" }}>
        <div className="stack" style={{ gap: "0.5rem" }}>
          <span className="eyebrow">
            Scrutin n° {num} · {leg}e législature · {fmtDate(date)}
          </span>
          <h1 style={{ fontSize: "var(--step-3)", maxWidth: "40ch" }}>{text >= 0 ? t.title[text] : capitalize(s.title[i])}</h1>
          <p className="lead" style={{ fontSize: "var(--step-0)" }}>
            {d ? capitalize(d.title.replace(/\.$/, "")) : capitalize(s.title[i])}
          </p>
          <div className="row">
            <span className="badge">{kindShort(core, i)}</span>
            {s.solemn[i] === 1 && <span className="badge solemn">Scrutin solennel</span>}
            <span className="badge">{core.meta.themes[s.theme[i]].label}</span>
            {s.reading[i] && <span className="badge">{capitalize(s.reading[i])}</span>}
          </div>
        </div>

        {detail.error && <ErrorBox error={detail.error} />}
        {!d && !detail.error && <Loading />}
        {d && (
          <>
            <div className="card stack">
              <p className="result-big">{capitalize(d.annonce || (s.adopted[i] ? "L'Assemblée nationale a adopté" : "L'Assemblée nationale n'a pas adopté"))}</p>
              <div className="kv">
                <div>
                  <span className="k">Pour</span>
                  <span className="v" style={{ color: "var(--ink)" }}>
                    {fmtInt(d.tot[0])}
                  </span>
                </div>
                <div>
                  <span className="k">Contre</span>
                  <span className="v">{fmtInt(d.tot[1])}</span>
                </div>
                <div>
                  <span className="k">Abstentions</span>
                  <span className="v">{fmtInt(d.tot[2])}</span>
                </div>
                <div>
                  <span className="k">Votants</span>
                  <span className="v">{fmtInt(d.votants)}</span>
                </div>
                <div>
                  <span className="k">Exprimés</span>
                  <span className="v">{fmtInt(d.exprimes)}</span>
                </div>
                {d.requis != null && (
                  <div>
                    <span className="k">{kind === "censure" ? "Majorité requise" : "Majorité"}</span>
                    <span className="v">{fmtInt(d.requis)}</span>
                  </div>
                )}
              </div>
              <ResultBar tot={d.tot} />
              {kind === "censure" && (
                <p className="note">
                  Pour une motion de censure, seuls les votes « pour » sont recueillis. Les députés qui ne la votent pas soutiennent, de fait, le maintien du
                  gouvernement.
                </p>
              )}
              <div className="row small">
                <a className="btn" href={anUrl} target="_blank" rel="noopener noreferrer">
                  Voir le scrutin officiel ↗
                </a>
                {d.dossier && (
                  <a className="btn" href={`https://www.assemblee-nationale.fr/dyn/${leg}/dossiers/${d.dossier}`} target="_blank" rel="noopener noreferrer">
                    Dossier législatif ↗
                  </a>
                )}
                {d.demandeur && <span className="muted">Scrutin public demandé par : {d.demandeur}</span>}
              </div>
              {d.lien && (d.lien.dossier || d.lien.amendement) && (
                <p className="note">
                  Rattachements (voir la méthode) : {d.lien.dossier ? `texte retrouvé par « ${d.lien.dossier} »` : "aucun texte"}
                  {d.lien.amendement ? `, amendement retrouvé par « ${d.lien.amendement} »` : ""}
                  {d.amdt?.source === "document" ? " (document individuel de l'Assemblée)" : ""}.
                </p>
              )}
            </div>

            {d.amdt && (
              <div className="card stack">
                <h2 className="card-title">L'amendement n° {d.amdt.num}</h2>
                <p>
                  {d.amdt.auteurFam && <FamChip id={d.amdt.auteurFam} />} <strong>{d.amdt.signataires || d.amdt.auteur}</strong>
                  {d.amdt.article ? ` · ${d.amdt.article.toLowerCase()}` : ""}
                  {d.amdt.sort ? ` · ${d.amdt.sort.toLowerCase()}` : ""}
                </p>
                {d.amdt.expose ? (
                  <>
                    <span className="eyebrow">Exposé sommaire (texte des auteurs)</span>
                    <p className="quote">{d.amdt.expose}</p>
                  </>
                ) : (
                  <p className="muted">Pas d'exposé sommaire publié.</p>
                )}
                {d.amdt.dispositif && (
                  <details className="howto">
                    <summary>Ce que l'amendement modifie dans le texte</summary>
                    <p className="quote">{d.amdt.dispositif}</p>
                  </details>
                )}
                <p className="small">
                  <a href={`https://www.assemblee-nationale.fr/dyn/${leg}/amendements/${d.amdt.uid}`} target="_blank" rel="noopener noreferrer">
                    Lire l'amendement complet sur le site de l'Assemblée ↗
                  </a>
                </p>
              </div>
            )}

            <div className="card stack">
              <div className="spread">
                <h2 className="card-title">Dans l'hémicycle</h2>
                <VoteLegend withSplit={false} />
              </div>
              {deps.data ? <Hemicycle seats={seats} /> : <Loading />}
              <p className="note">
                Un rond par député en fonction ce jour-là, regroupés par groupe politique, de la gauche (à gauche) à la droite. Cercle vide : absent ou n'a pas
                pris part au vote. Survolez un siège pour voir le nom.
              </p>
            </div>

            <div className="card stack">
              <h2 className="card-title">Vote de chaque groupe</h2>
              <div className="scroll-x">
                <table className="table">
                  <thead>
                    {kind === "censure" ? (
                      <tr>
                        <th>Groupe</th>
                        <th>Position</th>
                        <th>Ont voté la censure</th>
                        <th>Membres</th>
                      </tr>
                    ) : (
                      <tr>
                        <th>Groupe</th>
                        <th>Position</th>
                        <th>Pour</th>
                        <th>Contre</th>
                        <th>Abst.</th>
                        <th>Non-votants</th>
                        <th>Membres</th>
                        <th>Présents</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {core.meta.families
                      .filter((f) => d.fam[f.id])
                      .map((f) => {
                        const [p, c, a, n, mem] = d.fam[f.id];
                        const pos = f.hasPosition ? s.pos[i][core.posIndex[f.id]] : null;
                        if (kind === "censure")
                          return (
                            <tr key={f.id}>
                              <td>
                                <FamChip id={f.id} link />
                              </td>
                              <td>
                                {pos ? (
                                  <span className="vote-pill">
                                    <i style={{ background: pos === "P" ? VOTE_COLOR.P : "transparent", boxShadow: pos === "P" ? undefined : "inset 0 0 0 1px var(--line-2)" }} />
                                    {pos === "P" ? "A censuré" : "N'a pas censuré"}
                                  </span>
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>
                              <td>{p || ""}</td>
                              <td>{mem}</td>
                            </tr>
                          );
                        return (
                          <tr key={f.id}>
                            <td>
                              <FamChip id={f.id} link />
                            </td>
                            <td>
                              {pos ? (
                                <span className="vote-pill">
                                  <i
                                    style={{
                                      background: VOTE_COLOR[pos],
                                      boxShadow: pos === "-" ? "inset 0 0 0 1px var(--line-2)" : undefined,
                                    }}
                                  />
                                  {VOTE_LABEL[pos]}
                                </span>
                              ) : (
                                <span className="muted">—</span>
                              )}
                            </td>
                            <td>{p || ""}</td>
                            <td>{c || ""}</td>
                            <td>{a || ""}</td>
                            <td>{n || ""}</td>
                            <td>{mem}</td>
                            <td>{fmtPct((p + c + a + n) / Math.max(1, mem))}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              <p className="note">
                Position du groupe : le choix (pour, contre, abstention) fait par le plus grand nombre de ses membres ayant voté.
                {kind === "censure" && " Pour une censure : « pour » si plus de la moitié des membres l'ont votée."}
              </p>
            </div>

            {deps.data && (
              <div className="card stack">
                <h2 className="card-title">Qui a voté quoi</h2>
                {core.meta.families
                  .filter((f) => byFamVote.has(f.id))
                  .map((f) => (
                    <details key={f.id} className="howto">
                      <summary style={{ color: "var(--ink)" }}>
                        <FamChip id={f.id} long />{" "}
                        <span className="muted">
                          ·{" "}
                          {["P", "C", "A", "N"]
                            .filter((v) => byFamVote.get(f.id)!.has(v))
                            .map((v) => `${VOTE_LABEL[v].toLowerCase()} ${byFamVote.get(f.id)!.get(v)!.length}`)
                            .join(", ")}
                        </span>
                      </summary>
                      {["P", "C", "A", "N"]
                        .filter((v) => byFamVote.get(f.id)!.has(v))
                        .map((v) => (
                          <div key={v} className="stack" style={{ gap: "0.3rem", marginBottom: "0.6rem" }}>
                            <strong className="small" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                              <span style={{ width: 10, height: 10, borderRadius: 3, background: VOTE_COLOR[v], display: "inline-block" }} />
                              {VOTE_LABEL[v]}
                            </strong>
                            <div className="names">
                              {byFamVote
                                .get(f.id)!
                                .get(v)!
                                .sort((x, y) => x.nom.localeCompare(y.nom, "fr"))
                                .map((dep) => (
                                  <div key={dep.id}>
                                    <a href={href({ page: "depute", id: dep.id })}>
                                      {dep.prenom} {dep.nom}
                                    </a>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                    </details>
                  ))}
              </div>
            )}

            {text >= 0 && <OtherVotes text={text} current={i} />}
          </>
        )}
      </div>
    </div>
  );
}

function ResultBar({ tot }: { tot: [number, number, number, number] }) {
  const sum = tot[0] + tot[1] + tot[2];
  if (!sum) return null;
  const parts: [string, number][] = [
    ["P", tot[0]],
    ["A", tot[2]],
    ["C", tot[1]],
  ];
  return (
    <div className="segbar" role="img" aria-label={`Pour ${tot[0]}, abstention ${tot[2]}, contre ${tot[1]}`}>
      {parts.map(([k, v]) =>
        v > 0 ? (
          <div key={k} style={{ flexGrow: v, flexBasis: 0, background: VOTE_COLOR[k], color: k === "A" ? "#12141a" : "#ffffff" }}>
            {v / sum >= 0.1 ? `${VOTE_LABEL[k]} ${fmtPct(v / sum)}` : ""}
          </div>
        ) : null,
      )}
    </div>
  );
}

function OtherVotes({ text, current }: { text: number; current: number }) {
  const core = useCore();
  const items = React.useMemo(() => {
    const out: number[] = [];
    for (let i = core.N - 1; i >= 0; i--) if (core.s.text[i] === text && i !== current) out.push(i);
    return out;
  }, [core, text, current]);
  if (!items.length) return null;
  return (
    <div className="card stack">
      <h2 className="card-title">Les autres scrutins sur ce texte ({fmtInt(items.length)})</h2>
      <ScrutinList items={items} pageSize={10} />
    </div>
  );
}

export { famAt, famColor };
