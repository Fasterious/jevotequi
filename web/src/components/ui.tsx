import React from "react";
import { IS_ARTIFACT, useCore } from "../lib/data";
import { famColor, VOTE_COLOR, VOTE_LABEL } from "../lib/theme";
import { fmtInt, initials } from "../lib/format";
import { href } from "../lib/router";
import { useTipHandlers } from "./Tooltip";
import { DEFAULT_SCOPE, KIND_PRESETS, type Scope } from "../lib/stats";

export function FamDot({ id, size = "0.7em" }: { id: string; size?: string }) {
  return <span className="dot" aria-hidden="true" style={{ background: famColor(id), width: size, height: size, borderRadius: "50%", display: "inline-block", flex: "none" }} />;
}

export function FamChip({ id, long = false, link = false, className = "" }: { id: string; long?: boolean; link?: boolean; className?: string }) {
  const core = useCore();
  const f = core.famById[id];
  const label = f ? (long ? f.name : f.short) : id;
  const inner = (
    <span className={`chip ${className}`}>
      <FamDot id={id} />
      <span>{label}</span>
    </span>
  );
  return link && f && f.hasPosition ? (
    <a href={href({ page: "groupe", id })} style={{ textDecoration: "none" }}>
      {inner}
    </a>
  ) : (
    inner
  );
}

export function VotePill({ c, label }: { c: string; label?: string }) {
  return (
    <span className="vote-pill">
      <i
        className={c === "=" ? "vote-split" : undefined}
        style={{ background: VOTE_COLOR[c] ?? "transparent", boxShadow: c === "-" || c === "." ? "inset 0 0 0 1px var(--line-2)" : undefined }}
      />
      {label ?? VOTE_LABEL[c] ?? c}
    </span>
  );
}

/** Une case par famille : la position majoritaire de chaque groupe à ce scrutin. */
export function PositionStrip({ pos, fams }: { pos: string; fams?: string[] }) {
  const core = useCore();
  const tip = useTipHandlers();
  const list = fams ?? core.posFams;
  return (
    <span className="strip" role="img" aria-label={list.map((f) => `${core.famById[f].short} : ${VOTE_LABEL[pos[core.posIndex[f]]]}`).join(", ")}>
      {list.map((f) => {
        const c = pos[core.posIndex[f]];
        return (
          <i
            key={f}
            className={c === "-" ? "absent" : c === "=" ? "split" : undefined}
            style={c !== "-" && c !== "=" ? { background: VOTE_COLOR[c] } : undefined}
            {...tip(() => (
              <>
                <FamChip id={f} long /> : <strong>{VOTE_LABEL[c]}</strong>
              </>
            ))}
          />
        );
      })}
    </span>
  );
}

export function StripLabels({ fams }: { fams?: string[] }) {
  const core = useCore();
  const list = fams ?? core.posFams;
  return (
    <span className="strip-labels" aria-hidden="true">
      {list.map((f) => (
        <span key={f}>{core.famById[f].short}</span>
      ))}
    </span>
  );
}

export function VoteLegend({ withSplit = true }: { withSplit?: boolean }) {
  const items: [string, string][] = [
    ["P", "Pour"],
    ["C", "Contre"],
    ["A", "Abstention"],
  ];
  if (withSplit) items.push(["=", "Groupe partagé"], ["-", "Aucun vote"]);
  return (
    <div className="legend" aria-label="Légende des votes">
      {items.map(([c, l]) => (
        <span key={c}>
          <span
            className={`sw${c === "=" ? " vote-split" : ""}`}
            style={{ background: VOTE_COLOR[c], boxShadow: c === "-" ? "inset 0 0 0 1px var(--line-2)" : undefined }}
          />
          {l}
        </span>
      ))}
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <span className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </span>
  );
}

export function Avatar({ prenom, nom, fam, xl = false }: { prenom: string; nom: string; fam?: string; xl?: boolean }) {
  return (
    <span className={`avatar${xl ? " xl" : ""}`} style={fam ? { borderColor: famColor(fam) } : undefined} aria-hidden="true">
      {initials(prenom, nom)}
    </span>
  );
}

export function Loading({ label = "Chargement des votes…" }: { label?: string }) {
  return (
    <div className="loading" role="status">
      {label}
    </div>
  );
}

export function ErrorBox({ error }: { error: Error }) {
  return (
    <div className="error" role="alert">
      <strong>Les données n'ont pas pu être chargées.</strong> {error.message} Rechargez la page pour réessayer.
    </div>
  );
}

export function HowTo({ children, label = "Comment lire ce graphique ?" }: { children: React.ReactNode; label?: string }) {
  return (
    <details className="howto">
      <summary>{label}</summary>
      <div className="stack">{children}</div>
    </details>
  );
}

/* ------------------------------------------------------------------ périmètre global */

export const ScopeContext = React.createContext<[Scope, (s: Scope) => void]>([DEFAULT_SCOPE, () => {}]);
export const useScope = () => React.useContext(ScopeContext);

export function ScopeBar({ count, showTheme = false, showGov = false }: { count?: number; showTheme?: boolean; showGov?: boolean }) {
  const core = useCore();
  const [scope, setScope] = useScope();
  const set = (patch: Partial<Scope>) => setScope({ ...scope, ...patch });
  const preset = KIND_PRESETS.find((p) => p.id === scope.kind)!;
  return (
    <div className="filterbar" role="region" aria-label="Périmètre des calculs">
      <div className="row">
        <Segmented<number>
          label="Période"
          value={scope.leg}
          onChange={(v) => set({ leg: v as Scope["leg"], gov: "" })}
          options={[
            { value: 0, label: "Depuis 2022" },
            { value: 16, label: "2022-2024", title: "16e législature (juin 2022 – dissolution de juin 2024)" },
            { value: 17, label: "Depuis 2024", title: "17e législature (depuis juillet 2024)" },
          ]}
        />
        <label className="ctl">
          <span>Votes</span>
          <select className="select" value={scope.kind} title={preset.hint} onChange={(e) => set({ kind: e.target.value as Scope["kind"] })}>
            {KIND_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {showTheme && (
          <label className="ctl">
            <span>Thème</span>
            <select className="select" value={scope.theme} onChange={(e) => set({ theme: Number(e.target.value) })}>
              <option value={-1}>Tous</option>
              {core.meta.themes.map((t, i) => (
                <option key={t.id} value={i}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {showGov && (
          <label className="ctl">
            <span>Gouvernement</span>
            <select className="select" value={scope.gov} onChange={(e) => set({ gov: e.target.value })}>
              <option value="">Tous</option>
              {core.meta.governments
                .filter((g) => !scope.leg || (g.to ?? "9999") >= (scope.leg === 17 ? "2024-07-18" : "2022-06-28"))
                .filter((g) => !scope.leg || g.from <= (scope.leg === 16 ? "2024-06-09" : "9999"))
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label className="check" title="Exclut les scrutins où tous les groupes ont pris la même position.">
          <input type="checkbox" id="scope-contested" checked={scope.contested} onChange={(e) => set({ contested: e.target.checked })} />
          Scrutins disputés seulement
        </label>
        {count !== undefined && <span className="small muted num">{fmtInt(count)} scrutins retenus</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ partage */

export function useToast(): [React.ReactNode, (msg: string) => void] {
  const [msg, setMsg] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  return [msg ? <div className="toast" role="status">{msg}</div> : null, setMsg];
}

export function ShareButton({ text }: { text: string }) {
  const [toast, say] = useToast();
  const [fallback, setFallback] = React.useState<string | null>(null);
  const onClick = () => {
    // Dans un Artifact, l'adresse de la page est interne au lecteur : on copie la phrase seule.
    const full = IS_ARTIFACT ? `${text} (source : données ouvertes de l'Assemblée nationale)` : `${text}\n${window.location.href}`;
    try {
      navigator.clipboard.writeText(full).then(
        () => say(IS_ARTIFACT ? "Phrase copiée" : "Lien et phrase copiés"),
        () => setFallback(full),
      );
    } catch {
      setFallback(full);
    }
  };
  return (
    <>
      <button type="button" className="btn" onClick={onClick}>
        Copier pour partager
      </button>
      {fallback && (
        <textarea
          className="input small"
          readOnly
          rows={3}
          value={fallback}
          ref={(el) => el?.select()}
          aria-label="Texte à copier"
          onBlur={() => setFallback(null)}
        />
      )}
      {toast}
    </>
  );
}
