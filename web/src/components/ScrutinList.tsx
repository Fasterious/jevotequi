import React from "react";
import { useCore, type Core } from "../lib/data";
import { fmtDateShort, fmtInt, capitalize } from "../lib/format";
import { href } from "../lib/router";
import { FamChip, PositionStrip, StripLabels } from "./ui";

const KIND_SHORT: Record<string, string> = {
  ensemble: "Vote final",
  partie: "Partie de budget",
  censure: "Motion de censure",
  confiance: "Vote de confiance",
  declaration: "Déclaration",
  motion: "Motion",
  article: "Article",
  amendement: "Amendement",
  credits: "Crédits",
  resolution: "Résolution",
  procedure: "Procédure",
  autre: "Autre",
};

export function kindShort(core: Core, i: number): string {
  return KIND_SHORT[core.kindIds[core.s.kind[i]]] ?? "";
}

/** Intitulé lisible : le texte de loi en premier pour les votes finaux, l'objet du vote sinon. */
export function scrutinLabel(core: Core, i: number): { main: string; sub: string } {
  const { s, t } = core;
  const kind = core.kindIds[s.kind[i]];
  const text = s.text[i] >= 0 ? t.title[s.text[i]] : null;
  const reading = s.reading[i];
  const title = s.title[i];
  if ((kind === "ensemble" || kind === "partie") && text) {
    const what = kind === "ensemble" ? "Vote sur l'ensemble du texte" : capitalize(title);
    return { main: text, sub: [what, reading].filter(Boolean).join(" · ") };
  }
  if (kind === "censure") return { main: title.replace(/^La motion de censure,? /, "Motion de censure "), sub: text && !/^Motion de censure/i.test(text) ? text : "" };
  const sub = text && !title.toLowerCase().includes(text.toLowerCase().slice(0, 40)) ? `${text}${reading ? ` (${reading})` : ""}` : reading;
  return { main: title, sub: sub || "" };
}

function AuthorTag({ i }: { i: number }) {
  const core = useCore();
  const a = core.s.author[i];
  if (a < 0) return null;
  const id = core.meta.authors[a];
  if (id === "GOUV") return <span className="author">déposé par le Gouvernement</span>;
  if (id === "AUTRE") return <span className="author">déposé par un non-inscrit ou la commission</span>;
  return (
    <span className="author">
      déposé par <FamChip id={id} />
    </span>
  );
}

export function ScrutinRow({ i, right, showStrip = true }: { i: number; right?: React.ReactNode; showStrip?: boolean }) {
  const core = useCore();
  const { s } = core;
  const { main, sub } = scrutinLabel(core, i);
  return (
    <a className="srow" href={href({ page: "scrutin", leg: s.leg[i], num: s.num[i] })}>
      <span className="when">
        <span>{fmtDateShort(s.date[i])}</span>
        <span className="mono tiny muted">n° {s.num[i]}</span>
      </span>
      <span className="what">
        <span className="t1">{main}</span>
        {sub && <span className="t2">{sub}</span>}
        <span className="row" style={{ gap: "0.35rem" }}>
          <span className="badge">{kindShort(core, i)}</span>
          {s.solemn[i] === 1 && <span className="badge solemn">Solennel</span>}
          <span className={`badge ${s.adopted[i] ? "adopted" : "rejected"}`}>{s.adopted[i] ? "Adopté" : "Rejeté"}</span>
          <AuthorTag i={i} />
        </span>
      </span>
      <span className="side">
        {right}
        {showStrip && <PositionStrip pos={s.pos[i]} />}
      </span>
    </a>
  );
}

export function ScrutinList({
  items,
  pageSize = 25,
  right,
  showStrip = true,
  empty = "Aucun scrutin ne correspond.",
}: {
  items: number[] | Int32Array;
  pageSize?: number;
  right?: (i: number) => React.ReactNode;
  showStrip?: boolean;
  empty?: string;
}) {
  const [n, setN] = React.useState(pageSize);
  React.useEffect(() => setN(pageSize), [items, pageSize]);
  if (!items.length) return <p className="muted">{empty}</p>;
  const shown = Array.from(items.slice(0, n));
  return (
    <div className="slist">
      <div className="slist-head">
        <span>Date</span>
        <span>Scrutin</span>
        <span style={{ justifySelf: "end" }}>{showStrip ? <StripLabels /> : "Votes"}</span>
      </div>
      {shown.map((i) => (
        <ScrutinRow key={i} i={i} right={right?.(i)} showStrip={showStrip} />
      ))}
      {items.length > n && (
        <div className="more">
          <button type="button" className="btn" onClick={() => setN(n + pageSize * 2)}>
            Afficher plus ({fmtInt(items.length - n)} restants)
          </button>
        </div>
      )}
    </div>
  );
}
