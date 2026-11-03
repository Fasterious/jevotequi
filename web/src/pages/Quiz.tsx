import React from "react";
import { IS_ARTIFACT, loadDetail, useAsync, useCore } from "../lib/data";
import { fmtDate, fmtInt, fmtPct } from "../lib/format";
import { href } from "../lib/router";
import { famColor } from "../lib/theme";
import {
  BLOCK_SIZE,
  SOLID_PERCENT,
  STAGE_MIN,
  decodeAnswers,
  drawNext,
  encodeAnswers,
  famCounts,
  famPos,
  loadQuiz,
  loadSaved,
  measureAdopted,
  profileStage,
  ranked,
  remaining,
  save,
  scoreAll,
  solidity,
  solidityPercent,
  wilson,
  type Answer,
  type FamScore,
  type QuizData,
  type QuizQuestion,
  type SavedQuiz,
  type Stage,
} from "../lib/quiz";
import { ErrorBox, FamChip, FamDot, Loading, useToast } from "../components/ui";

const BLOCK = BLOCK_SIZE;
const KIND_LABEL: Record<string, string> = {
  ensemble: "Vote sur l'ensemble du texte",
  amendement: "Vote sur un amendement",
  article: "Vote sur un article",
  declaration: "Vote sur une déclaration du gouvernement",
  resolution: "Vote sur une résolution",
};

/** Étapes du profil : des repères de précision, pas des récompenses. */
const STAGES: { id: Stage; label: string; rule: string }[] = [
  { id: "esquisse", label: "Profil esquissé", rule: `${STAGE_MIN.esquisse} réponses` },
  { id: "affine", label: "Profil affiné", rule: `${STAGE_MIN.affine} réponses` },
  { id: "solide", label: "Profil solide", rule: `dès ${STAGE_MIN.solide} réponses, groupe en tête dans au moins ${SOLID_PERCENT} % des tirages` },
];
const STAGE_LABEL: Record<Stage, string> = { esquisse: "Profil esquissé", affine: "Profil affiné", solide: "Profil solide" };

type Sol = ReturnType<typeof solidity>;

/** « A », « A et B », « A, B et C ». */
function joinFr(xs: string[]): string {
  return xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} et ${xs[xs.length - 1]}`;
}

const officialUrl = (q: QuizQuestion) => `https://www.assemblee-nationale.fr/dyn/${q.leg}/scrutins/${q.num}`;

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
  const answers = saved?.answers;
  const sol = React.useMemo(() => (answers ? solidity(data, answers) : null), [data, answers]);

  const update = React.useCallback((s: SavedQuiz | null) => {
    setSaved(s);
    save(s);
  }, []);

  const start = (themes: string[] | null) => {
    const order = drawNext(data, [], BLOCK, themes);
    update({ version: data.version, order, answers: {}, target: order.length, themes });
    setReveal(null);
    setStarted(true);
    window.scrollTo({ top: 0 });
  };

  if (!started || !saved) {
    return <Intro data={data} saved={saved} onStart={start} onResume={() => setStarted(true)} />;
  }

  const answeredCount = saved.order.filter((id) => id in saved.answers).length;
  const answered = Object.values(saved.answers).filter((a) => a !== "S").length;
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
    if (live.current) live.current.textContent = a === "S" ? "Question passée." : `Réponse enregistrée. ${same} groupes ont voté comme vous.`;
  };
  const next = () => {
    setReveal(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  /** Bloc suivant ; `themes` = null pour élargir à tous les thèmes. */
  const more = (themes: string[] | null) => {
    const add = drawNext(data, saved.order, BLOCK, themes);
    if (!add.length) return;
    update({ ...saved, themes, order: [...saved.order, ...add], target: saved.order.length + add.length });
    setReveal(null);
    window.scrollTo({ top: 0 });
  };
  const restart = () => {
    update(null);
    setStarted(false);
    setReveal(null);
    window.scrollTo({ top: 0 });
  };

  if (!current) {
    const left = remaining(data, saved.order, saved.themes);
    const leftAll = saved.themes ? remaining(data, saved.order, null) : left;
    return (
      <div className="wrap page">
        <Results
          data={data}
          order={saved.order}
          answers={saved.answers}
          rest={{ left, leftAll, restricted: !!saved.themes }}
          onMore={() => more(saved.themes)}
          onWiden={() => more(null)}
          onRestart={restart}
        />
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
        <aside className="quiz-side" aria-label="Votre profil">
          <div className="card stack">
            <h2 className="card-title">Votre profil se précise</h2>
            <Profile scores={scores} answered={answered} />
            {sol && <SolidityNote sol={sol} answered={answered} />}
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
  const total = data.questions.filter((q) => !q.retired).length;
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
        <h1>
          Les promesses, <span className="insecable">c'est bien.</span>{" "}
          <span className="insecable">
            <mark className="surligne anime">Les actes</mark>,
          </span>{" "}
          <span className="insecable">c'est mieux.</span>
        </h1>
        <p className="lead">
          Dites pour ou contre, comme les députés, sur {Math.min(BLOCK, pool || total)} textes réellement soumis à l'Assemblée depuis 2022. Après chaque réponse,
          découvrez comment chaque groupe a voté. Ensuite, affinez votre profil par blocs de {BLOCK} questions.
        </p>
      </section>

      <div className="quiz-steps">
        <div className="card">
          <strong>1. Vous dites pour ou contre</strong>
          <p className="small ink2">Sans avis, passez la question. Sur téléphone, faites glisser la carte à droite ou à gauche.</p>
        </div>
        <div className="card">
          <strong>2. Vous découvrez le vote réel</strong>
          <p className="small ink2">Groupe par groupe, avec le résultat officiel et le lien vers le scrutin.</p>
        </div>
        <div className="card">
          <strong>3. Votre profil s'affine</strong>
          <p className="small ink2">
            Par blocs de {BLOCK} questions, jusqu'à {total} : esquissé, puis affiné, puis solide quand le groupe en tête ne tient plus à quelques réponses.
            Votre profil reste sur votre appareil : revenez l'affiner quand vous voulez.
          </p>
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
              {unfinished ? "Nouvelle partie" : "Commencer"} · {Math.min(BLOCK, pool)} questions
            </button>
            {unfinished && (
              <button type="button" className="btn big" onClick={onResume}>
                Reprendre ({answered}/{saved!.order.length})
              </button>
            )}
          </div>
          <p className="small muted">
            Questions tirées au sort parmi {total} : un thème différent à chaque question d'un bloc tant que possible, et plus souvent les votes où les groupes se sont
            le plus partagés. Vos réponses restent sur votre appareil : rien n'est envoyé. Le quiz compare vos réponses à des votes passés ; il ne dit pas pour qui
            voter. <a href={href({ page: "methode" })}>Méthode</a>
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
  const [texte, setTexte] = React.useState(false);
  const texteOuvert = React.useRef(false);
  texteOuvert.current = texte;
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
      if (texteOuvert.current) return;
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
        {/* Contexte : date, texte et ce qui change ; jamais le résultat ni le vote des groupes (révélés après la réponse). */}
        <p className="quiz-ctx">
          <span className="quiz-ctx-label">Contexte</span>
          {q.ctx}
        </p>
        <button type="button" className="quiz-plus" onClick={() => setTexte(true)}>
          Lire le texte voté
        </button>
      </div>
      <div className="quiz-buttons" role="group" aria-label="Votre réponse">
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
      <p className="quiz-hint small muted">Faites glisser la carte, ou utilisez les flèches ← → du clavier (↓ pour passer).</p>
      {texte && (
        <TexteComplet
          q={q}
          onClose={() => setTexte(false)}
          onAnswer={(a) => {
            setTexte(false);
            commit(a);
          }}
        />
      )}
    </div>
  );
}

/** Le texte complet d'une question, avant de répondre : le résumé, ce que propose le texte, l'exposé de ses auteurs et
 *  le lien vers l'Assemblée, dans un panneau qu'on referme (Échap, ✕, clic à côté) ou d'où l'on répond directement.
 *  Le site ne nomme l'auteur qu'après la réponse, comme le vote des groupes ; l'exposé publié, lui, peut le nommer. */
function TexteComplet({ q, onClose, onAnswer }: { q: QuizQuestion; onClose: () => void; onAnswer: (a: Answer) => void }) {
  const core = useCore();
  const ref = React.useRef<HTMLDialogElement>(null);
  const detail = useAsync(() => loadDetail(core, q.leg, q.num), [q.uid]);
  React.useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);
  const amdt = detail.data?.amdt;
  const dossier = detail.data?.dossier;
  const abrege = (x: string) => /…$|\.\.\.$/.test(x.trim());
  return (
    <dialog
      ref={ref}
      className="texte-complet"
      aria-labelledby={`tc-${q.id}`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="tc-tete">
        <span className="eyebrow">
          {fmtDate(q.date)} · {KIND_LABEL[q.kind] ?? "Scrutin public"}
        </span>
        <button type="button" className="tc-fermer" onClick={onClose} aria-label="Fermer et revenir à la question">
          ✕
        </button>
      </div>
      <div className="tc-corps stack">
        <h2 id={`tc-${q.id}`} className="quiz-q">
          {q.q}
        </h2>
        <p className="quiz-ctx">
          <span className="quiz-ctx-label">En bref</span>
          {q.ctx}
        </p>
        {detail.loading && <Loading label="Chargement du texte…" />}
        {detail.error && (
          <p className="muted">
            Le texte voté n'a pas pu être chargé ici. Il reste consultable sur{" "}
            <a href="https://www.assemblee-nationale.fr/" target="_blank" rel="noopener noreferrer">
              le site de l'Assemblée nationale ↗
            </a>
            .
          </p>
        )}
        {amdt ? (
          <>
            {amdt.dispositif && (
              <section className="stack tc-bloc">
                <h3 className="card-title">Ce que propose l'amendement</h3>
                {amdt.article && (
                  <p className="small muted">
                    Il porte sur : {amdt.article.toLowerCase()} du {q.texte}.
                  </p>
                )}
                <p className="quote">{amdt.dispositif}</p>
              </section>
            )}
            {amdt.expose ? (
              <section className="stack tc-bloc">
                <h3 className="card-title">Pourquoi, selon ses auteurs</h3>
                <p className="small muted">Leur argumentaire, tel qu'ils l'ont publié : ce n'est pas celui du site, et les autres groupes n'en publient pas.</p>
                <p className="quote">{amdt.expose}</p>
              </section>
            ) : (
              <p className="muted">Pas d'exposé des motifs publié pour cet amendement.</p>
            )}
            <p className="small">
              <a href={`https://www.assemblee-nationale.fr/dyn/${q.leg}/amendements/${amdt.uid}`} target="_blank" rel="noopener noreferrer">
                {abrege(amdt.expose) || abrege(amdt.dispositif) ? "Lire l'amendement en entier" : "L'amendement"} sur le site de l'Assemblée ↗
              </a>{" "}
              <span className="muted">(la page indique aussi son auteur et le résultat du vote)</span>
            </p>
          </>
        ) : (
          detail.data && (
            <>
              <section className="stack tc-bloc">
                <h3 className="card-title">Le texte voté</h3>
                <p>{q.texte.charAt(0).toUpperCase() + q.texte.slice(1)}.</p>
              </section>
              {dossier && (
                <p className="small">
                  <a href={`https://www.assemblee-nationale.fr/dyn/${q.leg}/dossiers/${dossier}`} target="_blank" rel="noopener noreferrer">
                    Le dossier législatif sur le site de l'Assemblée ↗
                  </a>{" "}
                  <span className="muted">(il indique aussi le résultat du vote)</span>
                </p>
              )}
            </>
          )
        )}
        <p className="note">
          Le site n'affiche l'auteur et le vote de chaque groupe qu'après votre réponse, pour que vous répondiez sur le fond ; l'exposé des auteurs, lui, peut
          les nommer. Les extraits sont ceux publiés par l'Assemblée nationale, parfois abrégés.
        </p>
      </div>
      <div className="quiz-buttons tc-pied" role="group" aria-label="Votre réponse">
        <button type="button" className="vote-btn contre" onClick={() => onAnswer("C")}>
          <span aria-hidden="true">✕</span> Contre
        </button>
        <button type="button" className="vote-btn passer" onClick={() => onAnswer("S")}>
          Passer
        </button>
        <button type="button" className="vote-btn pour" onClick={() => onAnswer("P")}>
          <span aria-hidden="true">✓</span> Pour
        </button>
      </div>
    </dialog>
  );
}

/* ================================================================== révélation */

const REL_LABEL: Record<string, string> = { same: "comme vous", opp: "à l'inverse de vous", abst: "abstention", split: "groupe partagé" };

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
      // Entrée sur un lien ou un bouton : son action à lui (ouvrir le scrutin, déplier le détail…)
      if (e.key === "Enter" && t?.closest("a, button, summary")) return;
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
          {a === "S" ? (
            "Question passée"
          ) : (
            <>
              Votre réponse : <span className={`answer-badge ${a === "P" ? "pour" : "contre"}`}>{a === "P" ? "pour" : "contre"}</span>
            </>
          )}
        </h2>
        {a !== "S" && (
          <p className="ink2">
            {nSame === 0 ? "Aucun groupe n'a voté comme vous." : nSame === 1 ? "Un seul groupe a voté comme vous." : `${nSame} groupes ont voté comme vous.`}
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
        <div className="reveal-links">
          <a className="btn" href={officialUrl(q)} target="_blank" rel="noopener noreferrer">
            Voir le scrutin officiel <span aria-hidden="true">↗</span>
            <span className="sr-only"> sur le site de l'Assemblée nationale (nouvel onglet)</span>
          </a>
          <a className="btn" href={href({ page: "scrutin", leg: q.leg, num: q.num })}>
            Voir le vote de chaque député
          </a>
        </div>
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
      <span className="muted">Le plus proche de vous :</span>
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
  const r = ranked(scores);
  if (!r.length) return <p className="small muted">Répondez à une première question : votre profil apparaîtra ici.</p>;
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
        {answered < STAGE_MIN.esquisse ? "Encore peu de réponses : le classement va beaucoup bouger. " : ""}
        La zone colorée montre la marge d'incertitude de chaque pourcentage (90 %).
      </p>
    </div>
  );
}

/** Phrase de solidité : « Le groupe en tête le reste dans 82 % des tirages de vos réponses. » */
function soliditySentence(sol: Sol, whose: string): string | null {
  if (sol.share == null) return null;
  const pct = fmtPct(solidityPercent(sol.share) / 100);
  return sol.top.length > 1
    ? `Les groupes à égalité en tête le restent dans ${pct} des tirages de ${whose}.`
    : `Le groupe en tête le reste dans ${pct} des tirages de ${whose}.`;
}

/** Pendant la partie, sous le profil : palier atteint et solidité, à partir de 10 réponses. */
function SolidityNote({ sol, answered }: { sol: Sol; answered: number }) {
  const stage = profileStage(answered, sol.share);
  const sentence = soliditySentence(sol, "vos réponses");
  if (!stage || !sentence) return null;
  return (
    <p className="small quiz-solidity">
      <strong>{STAGE_LABEL[stage]}</strong> · {sentence}
    </p>
  );
}

/** Les trois étapes du profil, l'étape actuelle mise en évidence. */
function StageSteps({ stage }: { stage: Stage | null }) {
  const cur = stage ? STAGES.findIndex((s) => s.id === stage) : -1;
  return (
    <ol className="quiz-stages" aria-label="Étapes du profil">
      {STAGES.map((s, i) => (
        <li key={s.id} className={i < cur ? "done" : i === cur ? "current" : "todo"} aria-current={i === cur ? "step" : undefined}>
          <span className="quiz-stage-name">
            {s.label}
            {i < cur && <span className="sr-only"> (étape franchie)</span>}
          </span>
          <span className="quiz-stage-rule">{s.rule}</span>
        </li>
      ))}
    </ol>
  );
}

/* ================================================================== résultats */

interface Rest {
  /** Questions restantes dans les thèmes choisis. */
  left: number;
  /** Questions restantes, tous thèmes confondus. */
  leftAll: number;
  restricted: boolean;
}

/** Après chaque bloc : invitation à affiner le profil avec le bloc suivant. */
function BlockInvite({ asked, rest, onMore, onWiden }: { asked: number; rest: Rest; onMore?: () => void; onWiden?: () => void }) {
  const { left, leftAll, restricted } = rest;
  const scope = restricted ? " des thèmes choisis" : "";
  let text: React.ReactNode;
  let action: React.ReactNode = null;
  if (left > 0) {
    const what = left >= BLOCK ? `${BLOCK} questions de plus` : left === 1 ? `la dernière question${scope}` : `les ${left} dernières questions${scope}`;
    const label = left >= BLOCK ? `${BLOCK} questions de plus` : left === 1 ? "La dernière question" : `Les ${left} dernières questions`;
    text = (
      <>
        Ces {asked} questions ont été tirées au sort : affinez votre profil avec {what}. Il reste sur votre appareil : vous pouvez aussi revenir le compléter plus tard.
      </>
    );
    action = (
      <button type="button" className="btn primary big" onClick={onMore}>
        {label} →
      </button>
    );
  } else if (leftAll > 0) {
    const n = Math.min(BLOCK, leftAll);
    text = (
      <>
        Vous avez répondu à toutes les questions des thèmes choisis. Pour affiner votre profil, ajoutez les autres thèmes : {n} question{n > 1 ? "s" : ""} de plus.
      </>
    );
    action = (
      <button type="button" className="btn primary big" onClick={onWiden}>
        Ajouter les autres thèmes →
      </button>
    );
  } else {
    text = <>Vous avez parcouru les {asked} questions du quiz : votre profil ne peut plus s'affiner ici. Chaque vote reste détaillé plus bas, avec le lien vers son scrutin.</>;
  }
  return (
    <section className="card quiz-invite" aria-label="Affiner votre profil">
      <p>{text}</p>
      {action}
    </section>
  );
}

function Results({
  data,
  order,
  answers,
  rest,
  onMore,
  onWiden,
  onRestart,
  shared = false,
}: {
  data: QuizData;
  order: string[];
  answers: Record<string, Answer>;
  rest?: Rest;
  onMore?: () => void;
  onWiden?: () => void;
  onRestart?: () => void;
  shared?: boolean;
}) {
  const core = useCore();
  const scores = scoreAll(data, answers);
  const r = ranked(scores);
  const answered = Object.values(answers).filter((a) => a !== "S").length;
  const sol = React.useMemo(() => solidity(data, answers), [data, answers]);
  const stage = profileStage(answered, sol.share);
  const lead = r[0];
  const tops = lead ? sol.topFams : [];
  const tie = tops.length > 1;
  /** Nombre de votes comptés pour chaque groupe à égalité (un groupe créé en 2024 en a moins). */
  const tieVotes = [...new Set(tops.map((f) => scores.find((s) => s.fam === f)?.n ?? 0))].sort((x, y) => y - x);
  const name = (f: string) => core.famById[f]?.name ?? f;
  const whose = shared ? "ces réponses" : "vos réponses";
  const sentence = answered >= STAGE_MIN.esquisse ? soliditySentence(sol, whose) : null;
  const [toast, say] = useToast();
  const [fallback, setFallback] = React.useState<string | null>(null);
  const byId = new Map(data.questions.map((q) => [q.id, q]));
  const asked = order.map((id) => byId.get(id)!).filter((q) => q && q.id in answers);

  const share = () => {
    const who = tie ? `des groupes ${joinFr(tops.map(name))}` : lead ? `du groupe ${name(lead.fam)}` : "";
    const text = lead
      ? `Au quiz « Je vote qui ? », mes réponses à ${answered} vrais votes de l'Assemblée ressemblent à ${fmtPct(lead.rate)} aux votes ${who}. Et vous ?`
      : "Le quiz « Je vote qui ? » : de vrais votes de l'Assemblée nationale.";
    const code = encodeAnswers(data, order, answers);
    const url = IS_ARTIFACT ? "" : `${window.location.origin}${window.location.pathname}#quiz-${code}`;
    const full = url ? `${text}\n${url}` : text;
    try {
      navigator.clipboard.writeText(full).then(
        () => say(url ? "Lien de vos résultats copié" : "Texte copié"),
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

  const stageText =
    stage === "solide"
      ? tie
        ? "Les groupes à égalité en tête ne dépendent plus de quelques réponses, mais ces réponses ne les départagent pas. Cela reste une tendance, pas un verdict."
        : "Le groupe en tête ne dépend plus de quelques réponses. Cela reste une tendance, pas un verdict."
      : stage === "affine"
        ? answered < STAGE_MIN.solide
          ? `La tendance se précise. On ne parle de profil solide qu'à partir de ${STAGE_MIN.solide} réponses.`
          : `La tendance se précise, mais ${tie ? "la tête du classement dépend" : "le groupe en tête dépend"} encore de quelques réponses : il faudrait ${
              tie ? "qu'elle reste la même" : "qu'il le reste"
            } dans au moins ${SOLID_PERCENT} % des tirages pour parler de profil solide.`
        : stage === "esquisse"
          ? "Une première tendance, qui peut encore beaucoup changer."
          : answered === 0
            ? `Aucune réponse pour l'instant : le profil s'esquisse à partir de ${STAGE_MIN.esquisse} réponses.`
            : `Le profil s'esquisse à partir de ${STAGE_MIN.esquisse} réponses (${answered} pour l'instant) : avant, le classement change trop d'une réponse à l'autre pour mesurer sa solidité.`;

  return (
    <div className="stack" style={{ gap: "1.4rem" }}>
      <section className="hero quiz-hero">
        <span className="eyebrow">
          {shared ? "Résultats partagés" : "Votre résultat"} · {answered} réponse{answered > 1 ? "s" : ""}
          {stage ? ` · ${STAGE_LABEL[stage]}` : ""}
        </span>
        {lead ? (
          <h1>
            {shared ? "Ces réponses ressemblent" : "Vos réponses ressemblent"} le plus aux votes {tie ? "des groupes" : "du groupe"}{" "}
            {tops.map((f, i) => (
              <React.Fragment key={f}>
                {i > 0 && (i === tops.length - 1 ? " et " : ", ")}
                <span className="lead-fam" style={{ borderColor: famColor(f) }}>
                  {name(f)}
                </span>
              </React.Fragment>
            ))}
            {tie ? ", à égalité" : ""}
          </h1>
        ) : (
          <h1>Aucune réponse pour l'instant</h1>
        )}
        {lead && (
          <p className="lead">
            <strong className="num">{fmtPct(lead.rate)}</strong> d'accord {tie ? `avec chacun (sur ${joinFr(tieVotes.map(String))} votes)` : `sur ${lead.n} votes`}.{" "}
            {sentence
              ? `${sentence}${answered < STAGE_MIN.solide ? ` Avant ${STAGE_MIN.solide} réponses, ce chiffre surestime la stabilité du classement.` : ""}`
              : "Encore trop peu de réponses pour dire si ce classement est solide."}
          </p>
        )}
      </section>

      {!shared && rest && <BlockInvite asked={order.length} rest={rest} onMore={onMore} onWiden={onWiden} />}

      <div className="grid-2 quiz-results">
        <div className="card stack">
          <h2 className="card-title">Accord avec chaque groupe</h2>
          <Profile scores={scores} answered={answered} big />
        </div>
        <div className="card stack">
          <h2 className="card-title">{shared ? "Où en est ce profil" : "Où en est votre profil"}</h2>
          <StageSteps stage={stage} />
          <p className="small ink2">{stageText}</p>
          <details className="howto">
            <summary>Comment la solidité est-elle mesurée ?</summary>
            <p>
              On refait {fmtInt(sol.draws || 1000)} fois le classement en tirant au sort, avec remise, autant de questions qu'il y a de réponses : certaines
              comptent deux fois, d'autres pas du tout. La solidité est la part de ces tirages où le groupe en tête reste en tête (une égalité compte pour une
              part). Elle dit si le résultat tient à quelques questions ; ce n'est pas une probabilité d'appartenir à un groupe politique. Le tirage dépend des
              réponses elles-mêmes : les mêmes réponses donnent toujours le même chiffre.
            </p>
            <p>
              Profil solide : au moins {STAGE_MIN.solide} réponses et au moins {SOLID_PERCENT} % des tirages. Avec moins de réponses, ce calcul surestime la
              stabilité. Les marges des pourcentages peuvent se chevaucher alors que le classement est solide : deux groupes qui ont voté pareil sur presque toutes
              les questions ne se départagent que sur celles où ils diffèrent. <a href={href({ page: "methode" })}>Méthode</a>
            </p>
          </details>
        </div>
      </div>

      <section className="card stack" aria-labelledby="h-qm">
        <h2 id="h-qm" className="card-title">
          Ce que ce résultat veut dire
        </h2>
        <ul className="small ink2 tight-list">
          <li>Il compare {whose} aux votes réels des groupes à l'Assemblée nationale, pas à leurs programmes ni à leurs candidats.</li>
          <li>
            La position d'un groupe est le choix le plus fréquent parmi ses députés qui ont voté (pour, contre ou abstention). Même position : 1 point ; groupe
            abstenu : ½ point.
          </li>
          <li>
            Avec {answered} réponse{answered > 1 ? "s" : ""}, la marge d'incertitude de chaque pourcentage est d'environ ± {margin(answered)} points.
            {rest && rest.leftAll > 0 && !shared ? " D'autres questions la resserreront." : ""}
          </li>
          <li>C'est une tendance, pas un verdict : le quiz ne dit pas pour qui voter.</li>
          <li>Chaque question renvoie au scrutin officiel : vérifiez, et faites-vous votre avis.</li>
        </ul>
        <p className="small">
          Ce quiz vous a été utile ? <a href={href({ page: "projet", section: "avis" })}>Dites-nous comment l'améliorer →</a>
        </p>
        <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
          {shared ? (
            <a className="btn primary big" href="#quiz">
              Faire le quiz moi aussi
            </a>
          ) : (
            <>
              <button type="button" className="btn big" onClick={share}>
                Partager
              </button>
              <button type="button" className="btn big" onClick={onRestart}>
                Recommencer
              </button>
            </>
          )}
        </div>
        {fallback && <textarea className="input small" readOnly rows={3} value={fallback} ref={(el) => el?.select()} aria-label="Texte à copier" onBlur={() => setFallback(null)} />}
        {toast}
      </section>

      {themes.length > 1 && top.length > 0 && (
        <section className="card stack" aria-labelledby="h-qt">
          <h2 id="h-qt" className="card-title">
            Par thème
          </h2>
          <p className="small muted">Accord avec les groupes les plus proches, thème par thème (nombre de votes entre parenthèses : souvent un ou deux, à lire avec prudence).</p>
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
          {shared ? "Les réponses, vote par vote" : "Vos réponses, vote par vote"}
        </h2>
        <div className="row small muted" style={{ gap: "1rem", flexWrap: "wrap" }}>
          <span>
            <i className="rel-sq same" /> a voté comme {shared ? "la réponse" : "vous"}
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
  const decoded = React.useMemo(() => decodeAnswers(data, code), [data, code]);
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
      <Results data={data} order={decoded.order} answers={decoded.answers} shared />
    </div>
  );
}
