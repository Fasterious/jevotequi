import React from "react";
import { IS_ARTIFACT, useAsync, useCore } from "../lib/data";
import { fmtDate, fmtInt, fmtPct } from "../lib/format";
import { href } from "../lib/router";
import { famColor } from "../lib/theme";
import {
  decodeAnswers,
  drawNext,
  encodeAnswers,
  famCounts,
  famPos,
  loadQuiz,
  loadSaved,
  measureAdopted,
  ranked,
  remaining,
  save,
  scoreAll,
  tiedWithLeader,
  wilson,
  type Answer,
  type FamScore,
  type QuizData,
  type QuizQuestion,
  type SavedQuiz,
} from "../lib/quiz";
import { ErrorBox, FamChip, FamDot, Loading, useToast } from "../components/ui";

const FIRST = 20;
const MORE = 10;
const KIND_LABEL: Record<string, string> = {
  ensemble: "Vote sur l'ensemble du texte",
  amendement: "Vote sur un amendement",
  article: "Vote sur un article",
  declaration: "Vote sur une déclaration du gouvernement",
  resolution: "Vote sur une résolution",
};

export function Quiz({ code }: { code?: string }) {
  const st = useAsync(loadQuiz, []);
  if (st.error) {
    return (
      <div className="wrap page">
        <ErrorBox error={st.error} />
      </div>
    );
  }
  if (!st.data) {
    return (
      <div className="wrap page">
        <Loading label="Chargement du quiz…" />
      </div>
    );
  }
  if (code) return <Shared data={st.data} code={code} />;
  return <Game data={st.data} />;
}

/* ================================================================== partie */

function Game({ data }: { data: QuizData }) {
  const [saved, setSaved] = React.useState<SavedQuiz | null>(() => loadSaved(data));
  const [started, setStarted] = React.useState(false);
  const [reveal, setReveal] = React.useState<string | null>(null);
  const live = React.useRef<HTMLDivElement>(null);

  const update = React.useCallback((s: SavedQuiz | null) => {
    setSaved(s);
    save(s);
  }, []);

  const start = (themes: string[] | null) => {
    const order = drawNext(data, [], FIRST, themes);
    update({ version: data.version, order, answers: {}, target: order.length, themes });
    setReveal(null);
    setStarted(true);
    window.scrollTo({ top: 0 });
  };

  if (!started || !saved) {
    return <Intro data={data} saved={saved} onStart={start} onResume={() => setStarted(true)} />;
  }

  const answeredCount = saved.order.filter((id) => id in saved.answers).length;
  const current = reveal ?? saved.order.find((id) => !(id in saved.answers)) ?? null;
  const scores = scoreAll(data, saved.answers);
  const byId = new Map(data.questions.map((q) => [q.id, q]));

  const answer = (a: Answer) => {
    if (!current || reveal) return;
    const next = { ...saved, answers: { ...saved.answers, [current]: a } };
    update(next);
    setReveal(current);
    const q = byId.get(current)!;
    const same = a === "S" ? 0 : data.families.filter((_, i) => famPos(q, i) === a).length;
    if (live.current) live.current.textContent = a === "S" ? "Question passée." : `Réponse enregistrée. ${same} groupes ont voté comme toi.`;
  };
  const next = () => {
    setReveal(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const more = () => {
    const add = drawNext(data, saved.order, MORE, saved.themes);
    update({ ...saved, order: [...saved.order, ...add], target: saved.target + add.length });
  };
  const restart = () => {
    update(null);
    setStarted(false);
    setReveal(null);
    window.scrollTo({ top: 0 });
  };

  if (!current) {
    return (
      <div className="wrap page">
        <Results data={data} order={saved.order} answers={saved.answers} canMore={remaining(data, saved.order, saved.themes) > 0} onMore={more} onRestart={restart} />
      </div>
    );
  }
  const q = byId.get(current)!;
  const position = reveal ? saved.order.indexOf(reveal) + 1 : answeredCount + 1;

  return (
    <div className="wrap page quiz-page">
      <div className="quiz-layout">
        <div className="quiz-main">
          <Progress i={position} total={saved.target} onQuit={restart} />
          <MiniPodium scores={scores} />
          {reveal ? (
            <Reveal key={`r-${q.id}`} data={data} q={q} a={saved.answers[q.id]} onNext={next} last={position >= saved.target} />
          ) : (
            <SwipeCard key={q.id} q={q} onAnswer={answer} />
          )}
          <div ref={live} className="sr-only" aria-live="polite" />
        </div>
        <aside className="quiz-side" aria-label="Ton profil">
          <div className="card stack">
            <h2 className="card-title">Ton profil se précise</h2>
            <Profile scores={scores} answered={Object.values(saved.answers).filter((a) => a !== "S").length} />
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ================================================================== accueil */

function Intro({ data, saved, onStart, onResume }: { data: QuizData; saved: SavedQuiz | null; onStart: (t: string[] | null) => void; onResume: () => void }) {
  const core = useCore();
  const themes = core.meta.themes.filter((t) => data.stats.themes[t.id]);
  const [sel, setSel] = React.useState<Set<string>>(() => new Set(themes.map((t) => t.id)));
  const all = sel.size === themes.length;
  const pool = data.questions.filter((q) => !q.retired && sel.has(q.theme)).length;
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const answered = saved ? saved.order.filter((id) => id in saved.answers).length : 0;
  const unfinished = saved && answered < saved.order.length;

  return (
    <div className="wrap page">
      <section className="hero quiz-hero">
        <span className="eyebrow">Le quiz · de vrais votes de l'Assemblée nationale</span>
        <h1>Les promesses, c'est bien. Les actes, c'est mieux.</h1>
        <p className="lead">
          Vote comme un député sur {Math.min(FIRST, pool)} textes réellement soumis à l'Assemblée depuis 2022. Après chaque réponse, découvre comment chaque groupe
          a voté. À la fin, tu sais quels groupes ont le plus souvent voté comme toi.
        </p>
      </section>

      <div className="quiz-steps">
        <div className="card">
          <strong>1. Tu votes</strong>
          <p className="small ink2">Pour, contre, ou tu passes. Sur téléphone, fais glisser la carte à droite ou à gauche.</p>
        </div>
        <div className="card">
          <strong>2. Tu découvres le vote réel</strong>
          <p className="small ink2">Groupe par groupe, avec le résultat officiel et le lien vers le scrutin.</p>
        </div>
        <div className="card">
          <strong>3. Ton profil s'affine</strong>
          <p className="small ink2">Plus tu réponds, plus la marge d'incertitude se resserre.</p>
        </div>
      </div>

      <section className="section" aria-labelledby="h-themes">
        <div className="card stack">
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <h2 id="h-themes" className="card-title">
              Sur quels sujets ?
            </h2>
            <button type="button" className="linklike small" onClick={() => setSel(all ? new Set() : new Set(themes.map((t) => t.id)))}>
              {all ? "Tout désélectionner" : "Tout sélectionner"}
            </button>
          </div>
          <div className="theme-picks" role="group" aria-label="Thèmes du quiz">
            {themes.map((t) => (
              <button key={t.id} type="button" className="theme-pick" aria-pressed={sel.has(t.id)} onClick={() => toggle(t.id)}>
                {t.label}
                <span className="muted num"> {data.stats.themes[t.id]}</span>
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className="btn primary big" disabled={pool === 0} onClick={() => onStart(all ? null : [...sel])}>
              {unfinished ? "Nouvelle partie" : "Commencer"} · {Math.min(FIRST, pool)} questions
            </button>
            {unfinished && (
              <button type="button" className="btn big" onClick={onResume}>
                Reprendre ({answered}/{saved!.order.length})
              </button>
            )}
          </div>
          <p className="small muted">
            Questions tirées au hasard parmi {data.questions.filter((q) => !q.retired).length}, en couvrant tous les thèmes choisis. Tes réponses restent sur ton
            appareil : rien n'est envoyé. Le quiz compare tes réponses à des votes passés ; il ne dit pas pour qui voter. <a href={href({ page: "methode" }) + ""}>Méthode</a>
          </p>
        </div>
      </section>
    </div>
  );
}

/* ================================================================== carte */

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function SwipeCard({ q, onAnswer }: { q: QuizQuestion; onAnswer: (a: Answer) => void }) {
  const core = useCore();
  const ref = React.useRef<HTMLDivElement>(null);
  const startPt = React.useRef<{ x: number; y: number; id: number } | null>(null);
  const [dx, setDx] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [leaving, setLeaving] = React.useState<Answer | null>(null);
  const theme = core.meta.themes.find((t) => t.id === q.theme);

  const commit = React.useCallback(
    (a: Answer) => {
      if (leaving) return;
      if (prefersReducedMotion()) {
        onAnswer(a);
        return;
      }
      setLeaving(a);
      window.setTimeout(() => onAnswer(a), 230);
    },
    [leaving, onAnswer],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight") commit("P");
      else if (e.key === "ArrowLeft") commit("C");
      else if (e.key === "ArrowDown") commit("S");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit]);

  const threshold = () => Math.min(120, (ref.current?.offsetWidth ?? 400) * 0.28);
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || leaving) return;
    if ((e.target as HTMLElement).closest("button, a, summary, details")) return;
    startPt.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent) => {
    const s = startPt.current;
    if (!s || s.id !== e.pointerId) return;
    const x = e.clientX - s.x;
    if (Math.abs(x) > 6 && !ref.current?.hasPointerCapture(e.pointerId)) ref.current?.setPointerCapture(e.pointerId);
    setDx(x);
  };
  const onUp = (e: React.PointerEvent) => {
    const s = startPt.current;
    if (!s || s.id !== e.pointerId) return;
    startPt.current = null;
    setDragging(false);
    if (dx > threshold()) commit("P");
    else if (dx < -threshold()) commit("C");
    else setDx(0);
  };

  const t = threshold();
  const pour = Math.max(0, Math.min(1, dx / t));
  const contre = Math.max(0, Math.min(1, -dx / t));
  const transform = leaving
    ? leaving === "S"
      ? "translateY(-24px) scale(0.96)"
      : `translateX(${leaving === "P" ? 130 : -130}%) rotate(${leaving === "P" ? 14 : -14}deg)`
    : dx
      ? `translateX(${dx}px) rotate(${dx / 22}deg)`
      : undefined;

  return (
    <div className="swipe-zone">
      <div
        ref={ref}
        className={`card quiz-card${dragging ? " dragging" : ""}${leaving ? " leaving" : ""}`}
        style={{ transform, opacity: leaving ? 0 : 1 }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <span className="stamp stamp-pour" style={{ opacity: pour }} aria-hidden="true">
          Pour
        </span>
        <span className="stamp stamp-contre" style={{ opacity: contre }} aria-hidden="true">
          Contre
        </span>
        <div className="quiz-meta small">
          <span className="badge">{theme?.label ?? q.theme}</span>
          <span className="muted">
            {fmtDate(q.date)} · {KIND_LABEL[q.kind] ?? "Scrutin public"}
          </span>
        </div>
        <h2 className="quiz-q">{q.q}</h2>
        <p className="quiz-ctx">{q.ctx}</p>
      </div>
      <div className="quiz-buttons" role="group" aria-label="Ta réponse">
        <button type="button" className="vote-btn contre" onClick={() => commit("C")} aria-keyshortcuts="ArrowLeft">
          <span aria-hidden="true">✕</span> Contre
        </button>
        <button type="button" className="vote-btn passer" onClick={() => commit("S")} aria-keyshortcuts="ArrowDown">
          Passer
        </button>
        <button type="button" className="vote-btn pour" onClick={() => commit("P")} aria-keyshortcuts="ArrowRight">
          <span aria-hidden="true">✓</span> Pour
        </button>
      </div>
      <p className="quiz-hint small muted">Glisse la carte, ou utilise les flèches ← → du clavier (↓ pour passer).</p>
    </div>
  );
}

/* ================================================================== révélation */

const REL_LABEL: Record<string, string> = { same: "comme toi", opp: "l'inverse de toi", abst: "abstention", split: "groupe partagé" };

function relation(p: string, a: Answer): string {
  if (p === "A") return "abst";
  if (p === "=") return "split";
  if (a === "S") return p === "P" ? "pour" : "contre";
  return p === a ? "same" : "opp";
}

function Reveal({ data, q, a, onNext, last }: { data: QuizData; q: QuizQuestion; a: Answer; onNext: () => void; last: boolean }) {
  const core = useCore();
  const head = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => head.current?.focus(), []);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext]);

  const rows = data.families
    .map((f, i) => ({ f, p: famPos(q, i), c: famCounts(q, f) }))
    .filter((r) => r.p !== "-")
    .map((r) => ({ ...r, rel: relation(r.p, a) }));
  const orderRel = ["same", "pour", "abst", "split", "opp", "contre"];
  rows.sort((x, y) => orderRel.indexOf(x.rel) - orderRel.indexOf(y.rel));
  const nSame = rows.filter((r) => r.rel === "same").length;
  const adopted = measureAdopted(q);
  const [p, c, ab] = q.tot;
  const author =
    q.author === "GOUV"
      ? q.kind === "amendement"
        ? "Amendement du gouvernement"
        : q.kind === "declaration"
          ? "Déclaration du gouvernement"
          : "Projet de loi du gouvernement"
      : q.author && core.famById[q.author]
        ? null
        : q.texte.startsWith("proposition")
          ? "Proposition de loi (initiative de députés ou de sénateurs)"
          : null;

  return (
    <div className="card reveal stack" role="region" aria-label="Le vote réel">
      <div className="reveal-head">
        <h2 ref={head} tabIndex={-1} className="card-title">
          {a === "S" ? "Question passée" : <>Tu as voté <span className={`answer-badge ${a === "P" ? "pour" : "contre"}`}>{a === "P" ? "pour" : "contre"}</span></>}
        </h2>
        {a !== "S" && (
          <p className="ink2">
            {nSame === 0 ? "Aucun groupe n'a voté comme toi." : nSame === 1 ? "Un seul groupe a voté comme toi." : `${nSame} groupes ont voté comme toi.`}
          </p>
        )}
      </div>
      <p className="quiz-q small-q">{q.q}</p>
      <p className={`outcome ${adopted ? "adopted" : "rejected"}`}>
        {q.inv ? (
          <>
            Le vote portait sur un amendement de suppression, <strong>{q.res}</strong> ({fmtInt(p)} pour, {fmtInt(c)} contre) : la mesure a été{" "}
            <strong>{adopted ? "maintenue" : "écartée"}</strong>.
          </>
        ) : (
          <>
            L'Assemblée a <strong>{q.res}</strong> : {fmtInt(p)} pour, {fmtInt(c)} contre{ab ? `, ${fmtInt(ab)} abstentions` : ""}.
          </>
        )}
      </p>
      <ul className="reveal-grid" aria-label="Vote de chaque groupe">
        {rows.map((r) => (
          <li key={r.f} className={`rv rv-${r.rel}`}>
            <FamChip id={r.f} />
            <span className="rv-label">{REL_LABEL[r.rel] ?? (r.rel === "pour" ? "pour" : "contre")}</span>
            {r.c && (
              <span className="rv-count small muted num">
                {r.c[0]} pour · {r.c[1]} contre{r.c[2] ? ` · ${r.c[2]} abst.` : ""}
              </span>
            )}
          </li>
        ))}
      </ul>
      {(author || (q.author && core.famById[q.author])) && (
        <p className="small">
          {author ?? (
            <>
              Amendement déposé par un député du groupe <FamChip id={q.author!} long />
            </>
          )}
        </p>
      )}
      <details className="small">
        <summary>Ce qui a été voté exactement</summary>
        <p className="ink2" style={{ marginTop: "0.4rem" }}>
          Scrutin n° {q.num} ({q.leg}e législature), {fmtDate(q.date)} : {q.title}
        </p>
        {q.note && <p className="muted">{q.note}</p>}
        {q.inv && <p className="muted">Les positions ci-dessus sont celles des groupes sur la mesure décrite : voter contre l'amendement de suppression, c'était la soutenir.</p>}
      </details>
      <div className="reveal-actions">
        <a className="btn" href={href({ page: "scrutin", leg: q.leg, num: q.num })}>
          Voir le vote de chaque député
        </a>
        <button type="button" className="btn primary big" onClick={onNext}>
          {last ? "Voir mon résultat" : "Question suivante"} →
        </button>
      </div>
    </div>
  );
}

/* ================================================================== profil */

function Progress({ i, total, onQuit }: { i: number; total: number; onQuit: () => void }) {
  return (
    <div className="quiz-progress">
      <div className="row" style={{ justifyContent: "space-between", gap: "0.5rem" }}>
        <span className="small">
          Question <strong className="num">{i}</strong> sur <span className="num">{total}</span>
        </span>
        <button type="button" className="linklike small muted" onClick={onQuit}>
          Recommencer
        </button>
      </div>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={i - 1} aria-label="Progression">
        <span style={{ width: `${(100 * (i - 1)) / total}%` }} />
      </div>
    </div>
  );
}

function MiniPodium({ scores }: { scores: FamScore[] }) {
  const core = useCore();
  const r = ranked(scores).slice(0, 3);
  if (!r.length) return null;
  return (
    <div className="mini-podium small" aria-hidden="true">
      <span className="muted">Le plus proche de toi :</span>
      {r.map((s) => (
        <span key={s.fam} className="chip">
          <FamDot id={s.fam} />
          {core.famById[s.fam]?.short} <strong className="num">{fmtPct(s.rate)}</strong>
        </span>
      ))}
    </div>
  );
}

function Profile({ scores, answered, big = false }: { scores: FamScore[]; answered: number; big?: boolean }) {
  const core = useCore();
  const r = ranked(scores);
  if (!r.length) return <p className="small muted">Réponds à une première question : ton profil apparaîtra ici.</p>;
  const tied = tiedWithLeader(r);
  return (
    <div className="stack" style={{ gap: "0.6rem" }}>
      <ol className={`profile${big ? " big" : ""}`}>
        {r.map((s) => (
          <li key={s.fam}>
            <FamChip id={s.fam} long={big} />
            <span className="pbar" title={`${fmtPct(s.rate)} (marge : ${fmtPct(s.lo)} à ${fmtPct(s.hi)})`}>
              <span className="pband" style={{ left: `${100 * s.lo!}%`, width: `${100 * (s.hi! - s.lo!)}%`, background: famColor(s.fam) }} />
              <span className="pmark" style={{ left: `${100 * s.rate!}%`, background: famColor(s.fam) }} />
            </span>
            <span className="num pval">{fmtPct(s.rate)}</span>
          </li>
        ))}
      </ol>
      <p className="small muted">
        {answered < 8
          ? "Encore peu de réponses : le classement va beaucoup bouger."
          : tied.length
            ? `Avec ${answered} réponses, ${tied
                .slice(0, 4)
                .map((t) => core.famById[t.fam]?.short)
                .join(", ")}${tied.length > 4 ? "…" : ""} ${tied.length > 1 ? "restent" : "reste"} dans la marge d'incertitude du premier. Réponds à plus de questions pour départager.`
            : `Avec ${answered} réponses, l'écart avec le premier dépasse la marge d'incertitude.`}{" "}
        La zone colorée montre la marge (90 %).
      </p>
    </div>
  );
}

/* ================================================================== résultats */

function Results({
  data,
  order,
  answers,
  canMore,
  onMore,
  onRestart,
  shared = false,
}: {
  data: QuizData;
  order: string[];
  answers: Record<string, Answer>;
  canMore: boolean;
  onMore?: () => void;
  onRestart?: () => void;
  shared?: boolean;
}) {
  const core = useCore();
  const scores = scoreAll(data, answers);
  const r = ranked(scores);
  const answered = Object.values(answers).filter((a) => a !== "S").length;
  const tied = tiedWithLeader(r);
  const lead = r[0];
  const [toast, say] = useToast();
  const [fallback, setFallback] = React.useState<string | null>(null);
  const byId = new Map(data.questions.map((q) => [q.id, q]));
  const asked = order.map((id) => byId.get(id)!).filter((q) => q && q.id in answers);

  const share = () => {
    const leadName = lead ? core.famById[lead.fam]?.name : "";
    const text = lead
      ? `Au quiz « Je vote qui ? », mes réponses à ${answered} vrais votes de l'Assemblée ressemblent à ${fmtPct(lead.rate)} aux votes du groupe ${leadName}. Et toi ?`
      : "Le quiz « Je vote qui ? » : de vrais votes de l'Assemblée nationale.";
    const code = encodeAnswers(data, order, answers);
    const url = IS_ARTIFACT ? "" : `${window.location.origin}${window.location.pathname}#quiz-${code}`;
    const full = url ? `${text}\n${url}` : text;
    try {
      navigator.clipboard.writeText(full).then(
        () => say(url ? "Lien de tes résultats copié" : "Texte copié"),
        () => setFallback(full),
      );
    } catch {
      setFallback(full);
    }
  };

  // accord par thème, pour les groupes les plus proches
  const themes = core.meta.themes.filter((t) => asked.some((q) => q.theme === t.id && answers[q.id] !== "S"));
  const top = r.slice(0, 5).map((s) => s.fam);
  const themeRate = (theme: string, fam: string) => {
    const sub: Record<string, Answer> = {};
    for (const q of asked) if (q.theme === theme) sub[q.id] = answers[q.id];
    const s = scoreAll(data, sub).find((x) => x.fam === fam)!;
    return s;
  };

  return (
    <div className="stack" style={{ gap: "1.4rem" }}>
      <section className="hero quiz-hero">
        <span className="eyebrow">{shared ? "Résultats partagés" : "Ton résultat"} · {answered} votes</span>
        {lead ? (
          <h1>
            {shared ? "Ces réponses ressemblent" : "Tes réponses ressemblent"} le plus aux votes du groupe{" "}
            <span className="lead-fam" style={{ borderColor: famColor(lead.fam) }}>
              {core.famById[lead.fam]?.name}
            </span>
          </h1>
        ) : (
          <h1>Aucune réponse pour l'instant</h1>
        )}
        {lead && (
          <p className="lead">
            <strong className="num">{fmtPct(lead.rate)}</strong> d'accord sur {lead.n} votes
            {tied.length
              ? ` — mais ${tied
                  .slice(0, 3)
                  .map((t) => core.famById[t.fam]?.short)
                  .join(", ")} ${tied.length > 1 ? "sont" : "est"} statistiquement au coude-à-coude.`
              : "."}
          </p>
        )}
      </section>

      <div className="grid-2 quiz-results">
        <div className="card stack">
          <h2 className="card-title">Accord avec chaque groupe</h2>
          <Profile scores={scores} answered={answered} big />
        </div>
        <div className="card stack">
          <h2 className="card-title">Ce que ce résultat veut dire</h2>
          <ul className="small ink2 tight-list">
            <li>Il compare tes réponses aux votes réels des groupes à l'Assemblée nationale, pas à leurs programmes ni à leurs candidats.</li>
            <li>Un groupe vote « pour » ou « contre » selon ce qu'a voté la majorité de ses députés présents ; une abstention compte pour un demi-accord.</li>
            <li>
              Avec {answered} réponses, la marge d'incertitude est d'environ ± {margin(answered)} points.
              {canMore && !shared ? " Réponds à d'autres questions pour l'affiner." : ""}
            </li>
            <li>Chaque question renvoie au scrutin officiel : vérifie, et fais-toi ton avis.</li>
          </ul>
          <p className="small">
            Ce quiz t'a été utile ? <a href={href({ page: "projet", section: "avis" })}>Dis-nous comment l'améliorer →</a>
          </p>
          <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            {shared ? (
              <a className="btn primary big" href="#quiz">
                Faire le quiz moi aussi
              </a>
            ) : (
              <>
                {canMore && (
                  <button type="button" className="btn primary big" onClick={onMore}>
                    Affiner : {MORE} questions de plus
                  </button>
                )}
                <button type="button" className="btn big" onClick={share}>
                  Partager
                </button>
                <button type="button" className="btn big" onClick={onRestart}>
                  Recommencer
                </button>
              </>
            )}
          </div>
          {fallback && (
            <textarea className="input small" readOnly rows={3} value={fallback} ref={(el) => el?.select()} aria-label="Texte à copier" onBlur={() => setFallback(null)} />
          )}
          {toast}
        </div>
      </div>

      {themes.length > 1 && top.length > 0 && (
        <section className="card stack" aria-labelledby="h-qt">
          <h2 id="h-qt" className="card-title">
            Par thème
          </h2>
          <p className="small muted">Accord avec les groupes les plus proches de toi, thème par thème (nombre de votes entre parenthèses : souvent un ou deux, à lire avec prudence).</p>
          <div className="scroll-x">
            <table className="table quiz-theme-table">
              <thead>
                <tr>
                  <th>Thème</th>
                  {top.map((f) => (
                    <th key={f}>
                      <FamChip id={f} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {themes.map((t) => (
                  <tr key={t.id}>
                    <td>{t.label}</td>
                    {top.map((f) => {
                      const s = themeRate(t.id, f);
                      return (
                        <td key={f} className="num">
                          {s.n ? (
                            <span className="heat-cell" style={{ ["--v" as string]: String(s.rate) } as React.CSSProperties}>
                              {fmtPct(s.rate)} <span className="muted">({s.n})</span>
                            </span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card stack" aria-labelledby="h-qr">
        <h2 id="h-qr" className="card-title">
          {shared ? "Les réponses, vote par vote" : "Tes réponses, vote par vote"}
        </h2>
        <div className="row small muted" style={{ gap: "1rem", flexWrap: "wrap" }}>
          <span>
            <i className="rel-sq same" /> a voté comme {shared ? "la réponse" : "toi"}
          </span>
          <span>
            <i className="rel-sq opp" /> l'inverse
          </span>
          <span>
            <i className="rel-sq abst" /> abstention ou groupe partagé
          </span>
          {asked.some((q) => answers[q.id] === "S") && (
            <span>
              questions passées : <i className="rel-sq pour" /> pour <i className="rel-sq contre" /> contre
            </span>
          )}
        </div>
        <ol className="quiz-recap">
          {asked.map((q) => {
            const a = answers[q.id];
            return (
              <li key={q.id}>
                <div className="recap-q">
                  <span className={`answer-badge ${a === "P" ? "pour" : a === "C" ? "contre" : "passe"}`}>{a === "P" ? "pour" : a === "C" ? "contre" : "passé"}</span>
                  <span>{q.q}</span>
                </div>
                <div className="recap-strip" aria-label="Vote des groupes">
                  {data.families.map((f, i) => {
                    const p = famPos(q, i);
                    if (p === "-") return null;
                    const rel = a === "S" ? (p === "P" ? "pour" : p === "C" ? "contre" : "abst") : p === "A" || p === "=" ? "abst" : p === a ? "same" : "opp";
                    return (
                      <span key={f} className="recap-fam" title={`${core.famById[f]?.short} : ${p === "P" ? "pour" : p === "C" ? "contre" : p === "A" ? "abstention" : "partagé"}`}>
                        <i className={`rel-sq ${rel}`} />
                        {core.famById[f]?.short}
                      </span>
                    );
                  })}
                  <a className="small" href={href({ page: "scrutin", leg: q.leg, num: q.num })}>
                    le vote →
                  </a>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

/** Demi-largeur de l'intervalle de Wilson à 90 % pour une proportion de 50 %, en points. */
function margin(n: number): number {
  const [lo, hi] = wilson(0.5, Math.max(1, n));
  return Math.round((100 * (hi - lo)) / 2);
}

function Shared({ data, code }: { data: QuizData; code: string }) {
  const decoded = decodeAnswers(data, code);
  if (!decoded) {
    return (
      <div className="wrap page">
        <div className="card stack">
          <h1 className="card-title">Lien de résultats invalide</h1>
          <a className="btn primary" href="#quiz">
            Faire le quiz
          </a>
        </div>
      </div>
    );
  }
  return (
    <div className="wrap page">
      <Results data={data} order={decoded.order} answers={decoded.answers} canMore={false} shared />
    </div>
  );
}
