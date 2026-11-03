import React from "react";
import * as d3 from "d3";
import { IS_ARTIFACT, loadCensures, loadDeputies, useAsync, useCore, type Core } from "../lib/data";
import { agree, allQuarters, byField, matrix, quarterEnd, quarterStart, rate, selectIdx, series, type Agreement, type Scope } from "../lib/stats";
import { fmtInt, fmtMonthYear, fmtPct, fmtDate } from "../lib/format";
import { href } from "../lib/router";
import { AgreementTip, Matrix, MiniSeries, RampLegend, RankBars, ThemeHeat } from "../components/charts";
import { DeputyMap } from "../components/DeputyMap";
import { CensureChart } from "../components/CensureChart";
import { ScrutinList } from "../components/ScrutinList";
import { famColor } from "../lib/theme";
import { groupeAuHasard } from "../lib/hasard";
import { FILM, IconeLecture, VideoPresentation } from "../components/Video";
import { ErrorBox, FamChip, HowTo, Loading, ScopeBar, Segmented, useScope, VoteLegend } from "../components/ui";

export function scopeLabel(core: Core, sc: Scope): string {
  const parts: string[] = [];
  if (sc.leg) parts.push(sc.leg === 16 ? "2022-2024" : "depuis 2024");
  if (sc.kind !== "all") parts.push({ final: "votes finaux", key: "grands votes", amendement: "amendements", article: "articles", motion: "motions de rejet", censure: "motions de censure" }[sc.kind] ?? "");
  if (sc.theme >= 0) parts.push(core.meta.themes[sc.theme].label.toLowerCase());
  if (sc.gov) parts.push("gouvernement " + core.meta.governments.find((g) => g.id === sc.gov)?.label);
  if (sc.contested) parts.push("scrutins disputés");
  return parts.join(", ");
}

// Groupe de référence tiré au hasard à la première visite : aucun groupe n'est mis en avant par défaut.
// L'UDR, créée en 2024, est écartée du tirage pour que la référence existe sur toute la période.
function useRefFam(fams: string[]): [string, (f: string) => void] {
  const [v, setV] = React.useState<string>(() => groupeAuHasard(fams.filter((f) => f !== "UDR"), "qvq-ref"));
  const set = (f: string) => {
    setV(f);
    try {
      sessionStorage.setItem("qvq-ref", f);
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  };
  return [v, set];
}

export function Home() {
  const core = useCore();
  const [scope] = useScope();
  const [refFam, setRefFam] = useRefFam(core.posFams);
  const idx = React.useMemo(() => selectIdx(core, scope), [core, scope]);
  const visibleFams = React.useMemo(
    () => core.posFams.filter((f) => !(scope.leg === 16 && f === "UDR")),
    [core, scope.leg],
  );
  const others = visibleFams.filter((f) => f !== refFam);
  const ags = React.useMemo(
    () => others.map((f) => ({ f, ag: agree(core.famVec[f], core.famVec[refFam], idx) })),
    [core, idx, refFam, others.join()],
  );
  const refName = core.famById[refFam].short;
  const sl = scopeLabel(core, scope);
  const deps = useAsync(loadDeputies, []);
  const cens = useAsync(loadCensures, []);
  const [mapLeg, setMapLeg] = React.useState(17);

  const ranked = [...ags].filter((x) => x.ag.total > 0).sort((a, b) => (rate(b.ag) ?? 0) - (rate(a.ag) ?? 0));
  const first = core.s.date[0];
  const last = core.s.date[core.N - 1];
  // « Voir le film » lance la vidéo de l'accroche ; sur téléphone, elle est sous le texte : on la fait venir à l'écran.
  const [film, setFilm] = React.useState(false);
  const filmRef = React.useRef<HTMLDivElement>(null);
  const voirFilm = () => {
    setFilm(true);
    filmRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="wrap">
      {/* L'accroche : la signature, la question, le quiz, puis le film. */}
      <section className="landing" aria-labelledby="h-accueil">
        <div className="landing-text">
          <span className="pastille">Présidentielle 2027</span>
          {/* Sur téléphone, chaque phrase passe sur deux lignes, jamais un mot seul : « c'est bien. », « c'est mieux. » restent entiers. */}
          <h1 id="h-accueil">
            Les promesses, <span className="insecable">c'est bien.</span>
            <br />
            <span className="insecable">
              <mark className="surligne anime">Les actes</mark>,
            </span>{" "}
            <span className="insecable">c'est mieux.</span>
          </h1>
          <p className="lead">
            Qui, à l'Assemblée, vote vraiment comme vous&nbsp;? Dites pour ou contre sur 10 vrais votes, et voyez quels groupes ont voté comme vous. Personne
            ici ne vous dit pour qui voter.
          </p>
          <div className="landing-ctas">
            <a className="btn primary big" href={href({ page: "quiz" })}>
              Faire le quiz →
            </a>
            {!IS_ARTIFACT && (
              <button type="button" className="btn big" onClick={voirFilm}>
                <IconeLecture />
                Voir le film <span className="video-duree">{FILM.duree}</span>
              </button>
            )}
          </div>
          <ul className="hero-trust" aria-label="Nos engagements">
            <li>Mêmes règles pour tous les groupes</li>
            <li>Chaque chiffre mène au scrutin officiel</li>
            <li>Sans compte, sans publicité, sans pistage</li>
            <li>
              <a href={href({ page: "projet", section: "avis" })}>Ouvert à vos corrections et à vos idées</a>
            </li>
          </ul>
        </div>
        {!IS_ARTIFACT && (
          <div className="landing-film" ref={filmRef}>
            <VideoPresentation lancee={film} onLancer={() => setFilm(true)} />
          </div>
        )}
      </section>

      <section className="section how" aria-labelledby="h-how">
        <div className="section-head">
          <h2 id="h-how">
            <mark className="surligne">{fmtInt(core.N)} scrutins publics</mark> de {fmtMonthYear(first)} à {fmtMonthYear(last)}.
          </h2>
          <p>Personne n'a le temps de tout lire. Le quiz vous en propose 10 pour commencer, puis 10 de plus pour affiner.</p>
        </div>
        <ol className="how-steps">
          <li>
            <strong>Vous dites pour ou contre</strong>
            <span>Sur de vrais textes de l'Assemblée, comme les députés. Le texte voté reste à portée de main.</span>
          </li>
          <li>
            <strong>Vous découvrez le vote réel</strong>
            <span>Groupe par groupe, avec le résultat officiel et le lien vers le scrutin.</span>
          </li>
          <li>
            <strong>Vous voyez qui vote comme vous</strong>
            <span>Les groupes les plus proches de vos réponses : une tendance, pas un verdict.</span>
          </li>
        </ol>
        <a className="quiz-cta" href={href({ page: "quiz" })}>
          <span className="quiz-cta-text">
            <strong>Et vous, vous auriez voté quoi&nbsp;?</strong>
            <span>10 questions pour commencer, sans compte. Votre profil reste sur votre appareil.</span>
          </span>
          <span className="btn primary big">Faire le quiz →</span>
        </a>
      </section>

      <div className="section-head explorer-head">
        <h2 id="h-explorer">Explorer les votes</h2>
      </div>
      <ScopeBar count={idx.length} showGov />

      <section className="section" aria-labelledby="h-ref">
        <div className="card stack">
          <h2 id="h-ref" style={{ fontSize: "var(--step-3)" }}>
            Qui vote comme{" "}
            <select className="select big" aria-label="Groupe de référence" value={refFam} onChange={(e) => setRefFam(e.target.value)}>
              {visibleFams.map((f) => (
                <option key={f} value={f}>
                  {core.famById[f].short}
                </option>
              ))}
            </select>{" "}
            ?
          </h2>
          <p className="ink2">
            Part des scrutins où chaque groupe a pris <strong>exactement la même position</strong> que {core.famById[refFam].name} (pour, contre ou
            abstention){sl ? ` — ${sl}` : ""}. Le groupe de départ est tiré au hasard à votre arrivée : choisissez celui qui vous intéresse.
          </p>
          <RankBars
            rows={ags.map(({ f, ag }) => ({
              id: f,
              dot: f,
              label: core.famById[f].short,
              ag,
              link: href({ page: "compare", a: f, b: refFam }),
              tip: () => <AgreementTip a={<FamChip id={f} />} b={<FamChip id={refFam} />} ag={ag} scopeLabel={sl} />,
            }))}
          />
          {ranked.length > 0 && (
            <p className="note">
              Lecture : sur les {fmtInt(ranked[0].ag.total)} scrutins où {core.famById[ranked[0].f].short} et {refName} ont tous deux pris position, ils ont
              voté de la même façon {fmtPct(rate(ranked[0].ag))} du temps. Cliquez sur un groupe pour voir chacun de ces votes.
            </p>
          )}
          <Facts refFam={refFam} scope={scope} others={others} />
        </div>
      </section>

      <section className="section" aria-labelledby="h-matrix">
        <div className="section-head">
          <h2 id="h-matrix">Toutes les paires</h2>
          <p>
            Chaque case indique la part des scrutins où deux groupes ont voté de la même façon. Les blocs foncés dessinent les alliances de vote réelles ; les
            cases claires, les oppositions.
          </p>
        </div>
        <div className="card stack">
          <MatrixBlock idx={idx} fams={visibleFams} sl={sl} />
          <RampLegend />
        </div>
      </section>

      <section className="section" aria-labelledby="h-time">
        <div className="section-head">
          <h2 id="h-time">Au fil du temps</h2>
          <p>
            Accord avec {core.famById[refFam].name}, trimestre par trimestre. Les bandes grises marquent les gouvernements successifs ; l'été 2024 est vide
            (dissolution, pas de séance).
          </p>
        </div>
        <div className="card">
          <Multiples refFam={refFam} fams={others} idx={idx} />
        </div>
      </section>

      <section className="section" aria-labelledby="h-themes">
        <div className="section-head">
          <h2 id="h-themes">Sujet par sujet</h2>
          <p>
            Accord avec {core.famById[refFam].name} selon le thème du texte voté. Entre parenthèses, le nombre de scrutins du thème. Cliquez sur une case pour
            voir les votes.
          </p>
        </div>
        <div className="card stack">
          <ThemeBlock refFam={refFam} fams={others} idx={idx} />
          <RampLegend label="Part des scrutins du thème où le groupe a voté comme le groupe de référence" />
        </div>
      </section>

      <section className="section" aria-labelledby="h-map">
        <div className="section-head">
          <h2 id="h-map">La carte des votes</h2>
          <p>
            Chaque point est un député. Plus deux points sont proches, plus ces deux députés ont voté de la même façon. Personne n'a placé les points à la
            main : la carte est calculée à partir de leurs votes.
          </p>
        </div>
        <div className="card stack">
          <div className="row">
            <Segmented<number>
              label="Législature de la carte"
              value={mapLeg}
              onChange={setMapLeg}
              options={[
                { value: 17, label: "Depuis 2024" },
                { value: 16, label: "2022-2024" },
              ]}
            />
            <span className="small muted">Survolez un point pour voir le député, cliquez pour ouvrir sa fiche.</span>
          </div>
          {deps.error ? <ErrorBox error={deps.error} /> : deps.data ? <DeputyMap deps={deps.data} leg={mapLeg} /> : <Loading />}
          <HowTo label="Comment la carte est-elle calculée ?">
            <p>
              Pour chaque paire de députés, on calcule la part des scrutins disputés où ils ont voté différemment. Une méthode statistique classique
              (positionnement multidimensionnel) place ensuite les points pour que leurs distances reflètent au mieux ces désaccords. Seuls les députés ayant au
              moins {core.meta.legislatures.find((l) => l.num === mapLeg)?.map?.minVotes ?? 100} votes sont représentés.
            </p>
            <p>
              Les axes n'ont pas d'unité. La carte est seulement tournée pour placer LFI à gauche, le RN à droite et Renaissance en haut. Les deux axes résument{" "}
              {fmtPct(d3.sum(core.meta.legislatures.find((l) => l.num === mapLeg)?.map?.explained ?? []))} des différences de vote.
            </p>
          </HowTo>
        </div>
      </section>

      <section className="section" aria-labelledby="h-key">
        <div className="section-head">
          <h2 id="h-key">Les grands votes</h2>
          <p>
            Les scrutins publics solennels : l'Assemblée les réserve aux textes les plus importants. Chaque case donne la position majoritaire d'un groupe.
          </p>
        </div>
        <div className="card stack">
          <KeyVotes scope={scope} />
        </div>
      </section>

      <section className="section" aria-labelledby="h-cens">
        <div className="section-head">
          <h2 id="h-cens">Censurer le gouvernement</h2>
          <p>
            Chaque barre est une motion de censure. Seuls les votes « pour » sont comptés : ne pas la voter revient à maintenir le gouvernement. Pour le
            renverser, il faut la majorité absolue des députés : 289 voix, un peu moins quand des sièges sont vacants (trait noir sur chaque barre).
          </p>
        </div>
        <div className="card stack">
          {cens.error ? <ErrorBox error={cens.error} /> : cens.data ? <CensureBlock items={cens.data} /> : <Loading />}
        </div>
      </section>

      <section className="section" aria-labelledby="h-more">
        <div className="section-head">
          <h2 id="h-more">Aller plus loin</h2>
        </div>
        <div className="cta-grid">
          <a className="cta" href={href({ page: "compare" })}>
            <h3>Comparer deux groupes ou deux députés</h3>
            <p>Taux d'accord, sujets de désaccord, évolution, et la liste de chaque vote.</p>
          </a>
          <a className="cta" href={href({ page: "scrutins" })}>
            <h3>Explorer les {fmtInt(core.N)} scrutins</h3>
            <p>Recherche par mot-clé, thème ou type de vote, et ce que chaque groupe a voté.</p>
          </a>
          <a className="cta" href={href({ page: "deputes" })}>
            <h3>Trouver un député</h3>
            <p>Sa présence aux votes, sa fidélité à son groupe, et avec qui il vote vraiment.</p>
          </a>
          <a className="cta" href={href({ page: "methode" })}>
            <h3>Comment c'est calculé</h3>
            <p>Sources, définitions, limites : tout est vérifiable, scrutin par scrutin.</p>
          </a>
        </div>
      </section>

      <section className="section home-help" aria-labelledby="h-help">
        <div className="home-help-text">
          <span className="eyebrow">Un outil citoyen, en construction</span>
          <h2 id="h-help">Aidez-nous à le rendre utile pour l'élection</h2>
          <p>
            Ces modules vous montrent qui a voté quoi, et quels groupes vous représentent le mieux dans les faits, pas seulement dans les paroles. D'autres
            viendront ensuite (programmes, promesses, comparatifs), en complément, jamais en remplacement. Dites-nous ce qui vous serait le plus utile.
          </p>
        </div>
        <div className="row" style={{ gap: "0.6rem", flexWrap: "wrap" }}>
          <a className="btn primary big" href={href({ page: "projet", section: "avis" })}>
            Donner mon avis
          </a>
          <a className="btn big" href={href({ page: "projet" })}>
            Le projet
          </a>
        </div>
      </section>
    </div>
  );
}

export function MatrixBlock({ idx, fams, sl }: { idx: Int32Array; fams: string[]; sl: string }) {
  const core = useCore();
  const m = React.useMemo(() => matrix(core, idx, fams), [core, idx, fams.join()]);
  return <Matrix fams={fams} data={m} scopeLabel={sl} />;
}

export function Multiples({ refFam, fams, idx }: { refFam: string; fams: string[]; idx: Int32Array }) {
  const core = useCore();
  const domain = React.useMemo<[Date, Date]>(() => {
    const qs = allQuarters(core);
    return [new Date(quarterStart(qs[0]) + "T00:00:00Z"), new Date(quarterEnd(qs[qs.length - 1]) + "T00:00:00Z")];
  }, [core]);
  const data = React.useMemo(
    () =>
      fams.map((f) => ({
        f,
        pts: series(core, core.famVec[f], core.famVec[refFam], idx),
        overall: agree(core.famVec[f], core.famVec[refFam], idx),
      })),
    [core, refFam, idx, fams.join()],
  );
  return (
    <div className="multiples">
      {data.map((d) => (
        <MiniSeries key={d.f} fam={d.f} refFam={refFam} points={d.pts} overall={d.overall} domain={domain} />
      ))}
    </div>
  );
}

export function ThemeBlock({ refFam, fams, idx }: { refFam: string; fams: string[]; idx: Int32Array }) {
  const core = useCore();
  const rows = React.useMemo(() => {
    const per = fams.map((f) => byField(core, "theme", core.famVec[f], core.famVec[refFam], idx));
    const counts = new Array(core.themeIds.length).fill(0);
    for (const i of idx) counts[core.s.theme[i]]++;
    return core.meta.themes
      .map((t, k) => ({ theme: k, label: t.label, cells: per.map((p) => p[k]), n: counts[k] }))
      .filter((r) => r.n >= 15)
      .sort((a, b) => b.n - a.n);
  }, [core, refFam, idx, fams.join()]);
  return <ThemeHeat refFam={refFam} fams={fams} rows={rows} />;
}

/* ------------------------------------------------------------------ faits saillants */

export function Facts({ refFam, scope, others }: { refFam: string; scope: Scope; others: string[] }) {
  const core = useCore();
  const facts = React.useMemo(() => {
    const out: { k: string; v: React.ReactNode }[] = [];
    const base = selectIdx(core, scope);
    const all = others.map((f) => ({ f, ag: agree(core.famVec[f], core.famVec[refFam], base) })).filter((x) => x.ag.total >= 30);
    if (all.length < 2) return out;
    all.sort((a, b) => rate(b.ag)! - rate(a.ag)!);
    const top = all[0],
      bottom = all[all.length - 1];
    out.push({
      k: "Le plus proche",
      v: (
        <>
          <FamChip id={top.f} /> : <mark>{fmtPct(rate(top.ag))}</mark> des votes
        </>
      ),
    });
    out.push({
      k: "Le plus éloigné",
      v: (
        <>
          <FamChip id={bottom.f} /> : <mark>{fmtPct(rate(bottom.ag))}</mark> des votes
        </>
      ),
    });
    if (scope.kind === "all") {
      const fin = selectIdx(core, { ...scope, kind: "final" });
      const deltas = all
        .map((x) => ({ ...x, fin: agree(core.famVec[x.f], core.famVec[refFam], fin) }))
        .filter((x) => x.fin.total >= 20)
        .map((x) => ({ ...x, d: rate(x.fin)! - rate(x.ag)! }))
        .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
      if (deltas.length) {
        const x = deltas[0];
        out.push({
          k: "Sur les seuls votes finaux",
          v: (
            <>
              <FamChip id={x.f} /> : {fmtPct(rate(x.fin))} <span className="muted small">(contre {fmtPct(rate(x.ag))} tous votes confondus)</span>
            </>
          ),
        });
      }
    }
    if (!scope.leg && !scope.gov) {
      const i16 = selectIdx(core, { ...scope, leg: 16 });
      const i17 = selectIdx(core, { ...scope, leg: 17 });
      const ev = others
        .map((f) => ({ f, a: agree(core.famVec[f], core.famVec[refFam], i16), b: agree(core.famVec[f], core.famVec[refFam], i17) }))
        .filter((x) => x.a.total >= 30 && x.b.total >= 30)
        .map((x) => ({ ...x, d: rate(x.b)! - rate(x.a)! }))
        .sort((p, q) => Math.abs(q.d) - Math.abs(p.d));
      if (ev.length) {
        const x = ev[0];
        out.push({
          k: "Plus forte évolution",
          v: (
            <>
              <FamChip id={x.f} /> : {fmtPct(rate(x.a))} → {fmtPct(rate(x.b))} <span className="muted small">(2022-2024 → depuis 2024)</span>
            </>
          ),
        });
      }
    }
    return out;
  }, [core, refFam, scope, others.join()]);
  if (!facts.length) return null;
  return (
    <div className="facts" aria-label="À retenir">
      {facts.map((f) => (
        <div className="fact" key={f.k}>
          <span className="k">{f.k}</span>
          <span className="v">{f.v}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ grands votes */

export function KeyVotes({ scope }: { scope: Scope }) {
  const core = useCore();
  const [theme, setTheme] = React.useState(-1);
  const items = React.useMemo(() => {
    const cens = core.kindIds.indexOf("censure");
    const out: number[] = [];
    for (let i = core.N - 1; i >= 0; i--) {
      if (!core.s.solemn[i] || core.s.kind[i] === cens) continue;
      if (scope.leg && core.s.leg[i] !== scope.leg) continue;
      if (theme >= 0 && core.s.theme[i] !== theme) continue;
      out.push(i);
    }
    return out;
  }, [core, scope.leg, theme]);
  return (
    <>
      <div className="spread">
        <VoteLegend />
        <label className="ctl">
          <span>Thème</span>
          <select className="select" value={theme} onChange={(e) => setTheme(Number(e.target.value))}>
            <option value={-1}>Tous</option>
            {core.meta.themes.map((t, k) => (
              <option key={t.id} value={k}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ScrutinList items={items} pageSize={8} empty="Aucun vote solennel pour ce thème." />
    </>
  );
}

/* ------------------------------------------------------------------ censure */

export function CensureBlock({ items }: { items: import("../lib/types").Censure[] }) {
  const core = useCore();
  const [scope] = useScope();
  const [hl, setHl] = React.useState<string | null>(null);
  const shown = items.filter((c) => !scope.leg || c.leg === scope.leg);
  const adopted = shown.filter((c) => c.adopted);
  const legendFams = core.meta.families.map((f) => f.id).filter((f) => shown.some((c) => c.fam[f] && c.fam[f][0] > 0));
  const support = core.meta.families
    .filter((f) => f.id !== "NI")
    .map((f) => {
      let n = 0,
        present = 0;
      for (const c of shown) {
        const x = c.fam[f.id];
        if (!x || !x[1]) continue;
        present++;
        if (x[0] * 2 > x[1]) n++;
      }
      return { f: f.id, n, present };
    })
    .filter((x) => x.present > 0);
  return (
    <>
      <p>
        <strong>{fmtInt(shown.length)} motions de censure</strong> votées{scope.leg ? (scope.leg === 16 ? " entre 2022 et 2024" : " depuis 2024") : " depuis 2022"}
        {adopted.length === 0
          ? " ; aucune n'a été adoptée."
          : adopted.length === 1
            ? ` ; une seule adoptée, le ${fmtDate(adopted[0].date)}, avec ${fmtInt(adopted[0].pour)} voix.`
            : ` ; ${adopted.length} adoptées.`}
      </p>
      <div className="legend" role="group" aria-label="Mettre un groupe en évidence">
        {legendFams.map((f) => (
          <button key={f} type="button" aria-pressed={hl === f} onClick={() => setHl(hl === f ? null : f)}>
            <span className="sw" style={{ background: famColor(f) }} />
            {core.famById[f].short}
          </button>
        ))}
      </div>
      <CensureChart items={shown} highlightFam={hl ?? undefined} />
      <div className="stack">
        <h3 style={{ fontSize: "var(--step-1)" }}>Combien de motions chaque groupe a-t-il votées ?</h3>
        <div className="grid-3" style={{ gap: "0.35rem 1.5rem" }}>
          {support
            .sort((a, b) => b.n / b.present - a.n / a.present)
            .map((s) => (
              <div key={s.f} className="spread" style={{ borderBottom: "1px solid var(--line)", padding: "0.3rem 0" }}>
                <FamChip id={s.f} />
                <span className="num">
                  <strong>{s.n}</strong> <span className="muted">sur {s.present}</span>
                </span>
              </div>
            ))}
        </div>
        <p className="note">
          Une motion est comptée comme votée par un groupe quand plus de la moitié de ses membres l'ont votée. Survolez une barre pour le détail, cliquez pour
          ouvrir le scrutin.
        </p>
      </div>
    </>
  );
}

export type { Agreement };
