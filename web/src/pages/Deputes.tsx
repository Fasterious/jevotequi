import React from "react";
import { fold, loadDeputies, useAsync, useCore } from "../lib/data";
import { fmtInt, fmtPct } from "../lib/format";
import { href } from "../lib/router";
import { Avatar, ErrorBox, FamChip, Loading, Segmented } from "../components/ui";
import type { Deputy } from "../lib/types";

type Sort = "nom" | "presence" | "fidelite";

export function Deputes() {
  const core = useCore();
  const deps = useAsync(loadDeputies, []);
  const [q, setQ] = React.useState("");
  const [leg, setLeg] = React.useState<"now" | "17" | "16">("now");
  const [fam, setFam] = React.useState("");
  const [dept, setDept] = React.useState("");
  const [sort, setSort] = React.useState<Sort>("nom");
  const legKey = leg === "16" ? "16" : "17";
  const depts = React.useMemo(() => {
    if (!deps.data) return [];
    const m = new Map<string, string>();
    for (const d of deps.data.list) {
      const L = d.legs[legKey];
      if (L?.dept) m.set(L.dept, L.deptNum ?? "");
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "fr", { numeric: true }));
  }, [deps.data, legKey]);
  const list = React.useMemo(() => {
    if (!deps.data) return [];
    const qq = fold(q.trim());
    const out: Deputy[] = [];
    for (const d of deps.data.list) {
      const L = d.legs[legKey];
      if (!L) continue;
      if (leg === "now" && L.to) continue;
      if (fam && L.fam !== fam) continue;
      if (dept && L.dept !== dept) continue;
      if (qq && !fold(`${d.prenom} ${d.nom}`).includes(qq)) continue;
      out.push(d);
    }
    const key = (d: Deputy) => {
      const L = d.legs[legKey];
      if (sort === "presence") return -(L.elig ? L.votes / L.elig : 0);
      if (sort === "fidelite") return -(L.loyal[1] ? L.loyal[0] / L.loyal[1] : 0);
      return 0;
    };
    out.sort((a, b) => key(a) - key(b) || fold(a.nom).localeCompare(fold(b.nom), "fr") || a.prenom.localeCompare(b.prenom, "fr"));
    return out;
  }, [deps.data, q, leg, legKey, fam, dept, sort]);
  const [n, setN] = React.useState(60);
  React.useEffect(() => setN(60), [q, leg, fam, dept, sort]);

  return (
    <div className="wrap page">
      <div className="stack" style={{ gap: "1.2rem" }}>
        <div className="section-head">
          <span className="eyebrow">Députés</span>
          <h1 style={{ fontSize: "var(--step-3)" }}>Trouver un député</h1>
          <p>Par nom ou par département. Chaque fiche montre ses votes, sa présence aux scrutins publics et avec qui il vote vraiment.</p>
        </div>
        <div className="card stack">
          <input className="input" type="search" id="deputes-q" placeholder="Nom d'un député" value={q} onChange={(e) => setQ(e.target.value)} style={{ fontSize: "1.05rem", padding: "0.65rem 0.9rem" }} />
          <div className="row" style={{ gap: "0.6rem 1rem" }}>
            <Segmented<"now" | "17" | "16">
              label="Mandat"
              value={leg}
              onChange={setLeg}
              options={[
                { value: "now", label: "En fonction" },
                { value: "17", label: "Depuis 2024" },
                { value: "16", label: "2022-2024" },
              ]}
            />
            <label className="ctl">
              <span>Groupe</span>
              <select className="select" value={fam} onChange={(e) => setFam(e.target.value)}>
                <option value="">Tous</option>
                {core.meta.families.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.short}
                  </option>
                ))}
              </select>
            </label>
            <label className="ctl">
              <span>Département</span>
              <select className="select" value={dept} onChange={(e) => setDept(e.target.value)}>
                <option value="">Tous</option>
                {depts.map(([d, num]) => (
                  <option key={d} value={d}>
                    {num} · {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="ctl">
              <span>Trier par</span>
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="nom">Nom</option>
                <option value="presence">Participation aux votes</option>
                <option value="fidelite">Vote avec son groupe</option>
              </select>
            </label>
          </div>
        </div>
        {deps.error && <ErrorBox error={deps.error} />}
        {!deps.data && !deps.error && <Loading label="Chargement des députés…" />}
        {deps.data && (
          <>
            <p className="small muted num">{fmtInt(list.length)} députés</p>
            <div className="dep-grid">
              {list.slice(0, n).map((d) => {
                const L = d.legs[legKey];
                const part = L.elig ? L.votes / L.elig : null;
                const loyal = L.loyal[1] ? L.loyal[0] / L.loyal[1] : null;
                return (
                  <a key={d.id} className="dep-card" href={href({ page: "depute", id: d.id })}>
                    <Avatar prenom={d.prenom} nom={d.nom} fam={L.fam} />
                    <span style={{ minWidth: 0 }}>
                      <span className="nm">
                        {d.prenom} {d.nom}
                      </span>
                      <br />
                      <span className="meta">
                        <FamChip id={L.fam} />
                        {L.dept ? ` · ${L.dept}${L.circo ? ` (${L.circo}e)` : ""}` : ""}
                      </span>
                      <br />
                      <span className="meta num">
                        A voté {fmtPct(part)} des scrutins · avec son groupe {fmtPct(loyal)}
                      </span>
                    </span>
                  </a>
                );
              })}
            </div>
            {list.length > n && (
              <div className="more">
                <button type="button" className="btn" onClick={() => setN(n + 120)}>
                  Afficher plus ({fmtInt(list.length - n)} restants)
                </button>
              </div>
            )}
            <p className="note">
              Participation : part des scrutins publics organisés pendant le mandat où le député a voté (pour, contre ou abstention). Beaucoup de scrutins sur des
              amendements ont lieu en séance de nuit ou en même temps que des réunions de commission : une participation faible ne signifie pas une absence de
              travail.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
