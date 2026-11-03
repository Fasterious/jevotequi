import React from "react";
import { useCore } from "../lib/data";
import { fmtInt } from "../lib/format";
import { href } from "../lib/router";
import { feedbackChannel, feedbackText, MAX_MESSAGE, MODULES, PROFILS, type Feedback, type Receipt } from "../lib/feedback";
import { useToast } from "../components/ui";

export function Projet({ section }: { section?: string }) {
  const core = useCore();
  React.useEffect(() => {
    if (section) document.getElementById(section)?.scrollIntoView({ block: "start" });
  }, [section]);

  const modules = [
    { label: "Le quiz", to: href({ page: "quiz" }), text: "Votez sur de vrais textes et découvrez quels groupes ont voté comme vous." },
    { label: "Comparer", to: href({ page: "compare" }), text: "Mesurez à quelle fréquence deux groupes, ou deux députés, votent de la même façon." },
    { label: "Les scrutins", to: href({ page: "scrutins" }), text: `Retrouvez chacun des ${fmtInt(core.N)} votes publics depuis 2022, avec le vote de chaque député.` },
    { label: "Les députés", to: href({ page: "deputes" }), text: "Consultez la participation et les votes de chaque élu, et ceux qui votent comme lui." },
    { label: "La méthode", to: href({ page: "methode" }), text: "Voyez comment chaque chiffre est calculé, vérifié et corrigé." },
  ];

  return (
    <div className="wrap page">
      <section className="hero">
        <span className="eyebrow">Le projet · présidentielle 2027</span>
        <h1 className="projet-title">Qui vous représente le mieux ? Dans les faits, pas seulement dans les paroles.</h1>
        <p className="lead">
          Ce site est un projet citoyen, indépendant et apartisan, pensé pour la période électorale. Il permet de savoir qui a voté quoi à l'Assemblée nationale, et
          de voir, à partir de vos propres choix, quels groupes vous ont le mieux représenté par leurs votes.
        </p>
      </section>

      <section className="section" aria-labelledby="h-modules">
        <div className="section-head">
          <h2 id="h-modules">Ce que vous pouvez déjà faire</h2>
        </div>
        <div className="cta-grid five">
          {modules.map((m) => (
            <a key={m.label} className="cta" href={m.to}>
              <h3>{m.label} →</h3>
              <p className="small ink2">{m.text}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="h-next">
        <div className="section-head">
          <h2 id="h-next">Et ensuite</h2>
          <p>
            D'autres modules viendront dans un second temps : les programmes des candidats, leurs promesses, et des comparatifs entre ce qui est promis et ce qui a
            été voté.
          </p>
        </div>
        <div className="promise-note">
          <strong>Ils compléteront ce que vous trouvez ici ; ils ne le remplaceront jamais.</strong>
          <span>
            Ce que les élus ont réellement voté est une information essentielle pour choisir, et c'est celle que l'actualité couvre le moins.
          </span>
        </div>
      </section>

      <section className="section" id="avis" aria-labelledby="h-avis">
        <div className="section-head">
          <h2 id="h-avis">Aidez-nous à améliorer cet outil</h2>
          <p>Dites-nous ce qui vous serait le plus utile pendant cette période électorale : vos réponses orientent les prochains modules.</p>
        </div>
        <FeedbackForm origine={section ? `projet-${section}` : "projet"} />
      </section>

      <section className="section" aria-labelledby="h-charte">
        <div className="section-head">
          <h2 id="h-charte">Nos engagements</h2>
        </div>
        <ul className="charte">
          <li>
            <strong>La même règle pour tous les groupes</strong>, écrite à l'avance et publiée, sans exception au cas par cas.
          </li>
          <li>
            <strong>Des faits, pas des commentaires</strong> : le site compte des votes ; il ne qualifie ni un vote ni un parti.
          </li>
          <li>
            <strong>Tout est vérifiable</strong> : chaque chiffre renvoie au scrutin officiel de l'Assemblée nationale.
          </li>
          <li>
            <strong>Aucune consigne de vote</strong> : le quiz compare vos réponses à des votes passés ; il ne dit pas pour qui voter.
          </li>
          <li>
            <strong>Rien n'est collecté sans votre geste</strong> : pas de compte, pas de traceur ; vos réponses au quiz restent sur votre appareil, et seul l'avis que
            vous choisissez d'envoyer est conservé.
          </li>
          <li>
            <strong>Les erreurs se corrigent en public</strong>, datées et expliquées. Le code et les données sont libres : chacun peut tout vérifier et tout réutiliser.
          </li>
        </ul>
      </section>
    </div>
  );
}

type Status = "idle" | "sending" | "sent" | "offline" | "error";

export function FeedbackForm({ origine }: { origine: string }) {
  const [mods, setMods] = React.useState<Set<string>>(new Set());
  const [message, setMessage] = React.useState("");
  const [profil, setProfil] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");
  const [copyText, setCopyText] = React.useState("");
  const [receipt, setReceipt] = React.useState<Receipt>({});
  const [trap, setTrap] = React.useState("");
  const t0 = React.useRef(Date.now());
  const [toast, say] = useToast();
  const empty = mods.size === 0 && !message.trim();

  React.useEffect(() => {
    void feedbackChannel(); // résolu à l'avance : l'envoi sera immédiat
  }, []);

  const toggle = (id: string) =>
    setMods((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (empty || status === "sending") return;
    const f: Feedback = {
      modules: [...mods],
      message: message.trim().slice(0, MAX_MESSAGE),
      profil,
      origine,
      date: new Date().toISOString(),
      version: "1.1.0",
      t0: t0.current,
      site: trap,
    };
    setCopyText(feedbackText(f));
    setStatus("sending");
    const ch = await feedbackChannel();
    if (ch.kind === "none") {
      setStatus("offline");
      return;
    }
    try {
      setReceipt(await ch.send(f));
      setStatus("sent");
    } catch (err) {
      // 503 : réception pas encore configurée sur ce site → proposer de copier l'avis
      const code = (err as { status?: number }).status;
      setStatus(ch.kind === "db" || code === 503 || code === 404 ? "offline" : "error");
    }
  };

  const copy = () => {
    try {
      navigator.clipboard.writeText(copyText).then(
        () => say("Avis copié"),
        () => say("Sélectionnez le texte pour le copier"),
      );
    } catch {
      say("Sélectionnez le texte pour le copier");
    }
  };

  if (status === "sent") {
    return (
      <div className="card stack feedback-done" role="status">
        <h3 className="card-title">Merci, votre avis est bien arrivé{receipt.numero ? ` (n° ${receipt.numero})` : ""}.</h3>
        <p className="ink2">
          Il est rangé dans le suivi du projet et sera lu pour choisir les prochains modules. Vous pouvez en envoyer un autre à tout moment.
          {receipt.url && (
            <>
              {" "}
              <a href={receipt.url} target="_blank" rel="noopener noreferrer">
                Suivre votre avis
              </a>
            </>
          )}
        </p>
        <div>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setMods(new Set());
              setMessage("");
              setProfil("");
              setReceipt({});
              t0.current = Date.now();
              setStatus("idle");
            }}
          >
            Donner un autre avis
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="card stack feedback" onSubmit={submit}>
      <fieldset className="stack">
        <legend className="card-title">Qu'est-ce qui vous aiderait le plus d'ici l'élection ?</legend>
        <p className="small muted">Plusieurs choix possibles.</p>
        <div className="theme-picks">
          {MODULES.map((m) => (
            <button key={m.id} type="button" className="theme-pick" aria-pressed={mods.has(m.id)} onClick={() => toggle(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="stack" style={{ gap: "0.35rem" }}>
        <span className="card-title">Une idée, un manque, une erreur repérée ?</span>
        <textarea
          className="input"
          rows={4}
          maxLength={MAX_MESSAGE}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ce qui vous manque, ce qui n'est pas clair, un scrutin qui vous semble faux…"
        />
        <span className="small muted num" style={{ justifySelf: "end" }}>
          {message.length} / {MAX_MESSAGE}
        </span>
      </label>
      <label className="row" style={{ gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
        <span>Vous êtes (facultatif)</span>
        <select className="select" value={profil} onChange={(e) => setProfil(e.target.value)}>
          <option value="">—</option>
          {PROFILS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="hp" aria-hidden="true">
        Ne pas remplir ce champ
        <input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
      </label>
      <p className="small muted">
        Votre avis rejoint le suivi du projet, sans nom ni adresse IP : pas besoin de compte. N'écrivez pas d'informations personnelles dans votre message.
      </p>
      <div className="row" style={{ gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
        <button type="submit" className="btn primary big" disabled={empty || status === "sending"}>
          {status === "sending" ? "Envoi…" : "Envoyer mon avis"}
        </button>
        {empty && <span className="small muted">Choisissez au moins un module ou écrivez un message.</span>}
      </div>
      {(status === "offline" || status === "error") && (
        <div className="feedback-fallback stack" role="status">
          <p>
            {status === "error"
              ? "L'envoi n'a pas abouti. Vous pouvez réessayer, ou copier votre avis :"
              : "L'envoi en ligne n'est pas encore ouvert sur cette version. Copiez votre avis et transmettez-le à la personne qui vous a partagé ce lien : il sera pris en compte."}
          </p>
          <textarea className="input small" readOnly rows={4} value={copyText} aria-label="Votre avis, à copier" onFocus={(e) => e.currentTarget.select()} />
          <div>
            <button type="button" className="btn" onClick={copy}>
              Copier mon avis
            </button>
          </div>
        </div>
      )}
      {toast}
    </form>
  );
}
