import React from "react";
import { fold, useCore, type DeputyIndex } from "../lib/data";
import { isDeputyId } from "../lib/stats";
import { Avatar, FamChip, FamDot } from "./ui";

/** Choix d'un groupe ou d'un député (recherche par nom). */
export function EntityPicker({
  id,
  label,
  value,
  onChange,
  deps,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  deps: DeputyIndex | undefined;
}) {
  const core = useCore();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const qq = fold(q.trim());
  const famOpts = core.posFams.filter((f) => !qq || fold(core.famById[f].name + " " + core.famById[f].short).includes(qq));
  const depOpts =
    deps && qq.length >= 2
      ? deps.list
          .filter((d) => fold(`${d.prenom} ${d.nom}`).includes(qq) || fold(`${d.nom} ${d.prenom}`).includes(qq))
          .slice(0, 25)
      : [];
  const opts: string[] = [...famOpts, ...depOpts.map((d) => d.id)];
  React.useEffect(() => setActive(0), [q]);
  React.useEffect(() => {
    const close = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQ("");
  };
  const current = isDeputyId(value) ? deps?.byId.get(value) : null;
  const display = isDeputyId(value)
    ? current
      ? `${current.prenom} ${current.nom}`
      : "Député"
    : core.famById[value]?.name ?? value;
  return (
    <div className="picker" ref={boxRef}>
      <label htmlFor={id}>{label}</label>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        {isDeputyId(value) && current ? (
          <Avatar prenom={current.prenom} nom={current.nom} fam={Object.values(current.legs).slice(-1)[0]?.fam} />
        ) : (
          <FamDot id={value} size="1rem" />
        )}
        <input
          id={id}
          className="input"
          role="combobox"
          aria-expanded={open}
          aria-controls={id + "-list"}
          aria-autocomplete="list"
          placeholder={display}
          value={open ? q : display}
          onFocus={() => {
            setOpen(true);
            setQ("");
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(opts.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" && opts[active]) {
              e.preventDefault();
              pick(opts[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          style={{ fontWeight: 700 }}
        />
      </div>
      {open && (
        <div className="picker-list" id={id + "-list"} role="listbox">
          {famOpts.length > 0 && <div className="grp">Groupes</div>}
          {famOpts.map((f, k) => (
            <button key={f} type="button" role="option" aria-selected={active === k} onPointerDown={(e) => e.preventDefault()} onClick={() => pick(f)}>
              <FamChip id={f} long />
            </button>
          ))}
          <div className="grp">Députés</div>
          {qq.length < 2 && <div className="small muted" style={{ padding: "0 0.55rem 0.4rem" }}>Tapez au moins 2 lettres d'un nom.</div>}
          {qq.length >= 2 && !deps && <div className="small muted" style={{ padding: "0 0.55rem 0.4rem" }}>Chargement…</div>}
          {qq.length >= 2 && deps && depOpts.length === 0 && <div className="small muted" style={{ padding: "0 0.55rem 0.4rem" }}>Aucun député trouvé.</div>}
          {depOpts.map((d, k) => {
            const legs = Object.keys(d.legs);
            const L = d.legs[legs[legs.length - 1]];
            return (
              <button
                key={d.id}
                type="button"
                role="option"
                aria-selected={active === famOpts.length + k}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(d.id)}
              >
                <Avatar prenom={d.prenom} nom={d.nom} fam={L.fam} />
                <span>
                  <strong>
                    {d.prenom} {d.nom}
                  </strong>
                  <br />
                  <span className="small muted">
                    <FamChip id={L.fam} />
                    {L.dept ? ` · ${L.dept}` : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
