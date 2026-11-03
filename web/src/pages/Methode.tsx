import React from "react";
import { getJSON, IS_ARTIFACT, useAsync, useCore } from "../lib/data";
import { fmtDate, fmtInt, fmtPct } from "../lib/format";
import { href } from "../lib/router";
import { FamChip, Loading } from "../components/ui";
import { loadQuiz } from "../lib/quiz";
import type { Check, Coverage, Sensitivity, SourceInfo } from "../lib/types";

const STATUT: Record<string, { label: string; mark: string }> = {
  ok: { label: "Conforme", mark: "✓" },
  alerte: { label: "Écart connu", mark: "!" },
  echec: { label: "Échec", mark: "✗" },
};

export function Methode() {
  const core = useCore();
  const m = core.meta;
  const first = core.s.date[0];
  const last = core.s.date[core.N - 1];
  const checks = useAsync(() => getJSON<Check[]>("controles.json"), []);
  const cov = useAsync(() => getJSON<Coverage>("couverture.json"), []);
  const sens = useAsync(() => getJSON<Sensitivity>("sensibilite.json"), []);
  const sources = useAsync(() => getJSON<Record<string, SourceInfo>>("sources.json"), []);
  const version = (m as unknown as { methodVersion?: string }).methodVersion ?? "1.0.0";
  return (
    <div className="wrap page">
      <article className="prose">
        <span className="eyebrow">Méthode · version {version}</span>
        <h1 style={{ fontSize: "var(--step-3)" }}>Comment c'est calculé</h1>
        <p className="lead">
          Ce site compte des votes. Il ne les interprète pas. Toutes les données viennent de l'Assemblée nationale ; chaque chiffre renvoie à la liste des
          scrutins qui le composent, puis à la page officielle de chaque scrutin. Le code et les données sont libres : n'importe qui peut refaire les calculs.
        </p>

        <h2>La question posée</h2>
        <p>
          À quelle fréquence deux groupes politiques, ou deux députés, prennent-ils la même position lors des votes de l'Assemblée ? Le site décrit des
          comportements de vote observés. Il ne dit pas si un vote était bon ou mauvais, ni pourquoi un groupe a voté ainsi.
        </p>

        <h2>Les données</h2>
        <ul>
          <li>
            Source unique : les <a href="https://data.assemblee-nationale.fr/" target="_blank" rel="noopener noreferrer">données ouvertes de l'Assemblée nationale</a>{" "}
            (Licence Ouverte Etalab 2.0) : scrutins, députés et groupes, gouvernements, dossiers législatifs, amendements.
          </li>
          <li>
            Période : {fmtInt(core.N)} scrutins publics, du {fmtDate(first)} au {fmtDate(last)} (16e législature, puis 17e depuis la dissolution de 2024).
            Données mises à jour le {fmtDate(m.generated.slice(0, 10))}.
          </li>
          <li>
            Ne sont pas couverts : les votes à main levée et en commission (non nominatifs), les scrutins secrets, et le Congrès du 4 mars 2024 (députés et
            sénateurs réunis).
          </li>
        </ul>

        <h3>Exhaustivité</h3>
        {cov.data ? <CoverageBlock cov={cov.data} /> : <Loading label="Chargement de la couverture…" />}

        <h2>Les définitions</h2>
        <h3>Position d'un groupe</h3>
        <p>
          Pour chaque scrutin, on compte les votes pour, contre et abstention des membres du groupe (apparentés compris), à partir des listes nominatives. La
          position du groupe est celle qui a réuni le plus de voix. En cas d'égalité, le groupe est « partagé » et n'entre pas dans les comparaisons ; si aucun
          membre n'a voté, il n'a pas de position. Les non-inscrits n'ont pas de position collective.
        </p>
        <p>
          Le champ « position majoritaire » publié par l'Assemblée n'est pas utilisé : il vaut « pour » par défaut quand aucun membre n'a voté, et contredit
          parfois les décomptes (par exemple au <a href={href({ page: "scrutin", leg: 17, num: 3985 })}>scrutin n° 3985</a> de la 17e législature).
        </p>
        <h3>Motions de censure</h3>
        <p>
          Seuls les votes « pour » sont recueillis. Un groupe est compté « pour » si plus de la moitié de ses membres a voté la motion, « contre » sinon : ne pas
          voter la censure revient à maintenir le gouvernement. La majorité requise est celle publiée pour chaque scrutin.
        </p>
        <h3>Taux d'accord</h3>
        <p>
          Pour deux groupes, deux députés, ou un député et un groupe, on retient les scrutins où les deux ont pris position. Le <strong>taux d'accord</strong> est
          la part de ces scrutins où leurs positions sont identiques. Le reste se partage entre votes opposés (l'un pour, l'autre contre) et désaccords partiels
          (l'un s'abstient). Le nombre de scrutins est toujours accessible ; un taux calculé sur moins de 30 scrutins est signalé comme fragile.
        </p>
        <h3>Familles politiques</h3>
        <p>
          Les groupes changent de nom d'une législature à l'autre. Pour suivre une même formation depuis 2022, chaque groupe est rattaché à une famille. Un député
          qui change de groupe est compté, à chaque vote, dans le groupe sous lequel son vote a été enregistré.
        </p>
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Famille</th>
                <th>16e législature (2022-2024)</th>
                <th>17e législature (depuis 2024)</th>
              </tr>
            </thead>
            <tbody>
              {m.families.map((f) => (
                <tr key={f.id}>
                  <td>
                    <FamChip id={f.id} long />
                  </td>
                  <td style={{ whiteSpace: "normal", textAlign: "left" }}>
                    {f.groups.filter((g) => g.leg === 16).map((g) => g.label).join(" ; ") || "—"}
                  </td>
                  <td style={{ whiteSpace: "normal", textAlign: "left" }}>
                    {f.groups.filter((g) => g.leg === 17).map((g) => g.label).join(" ; ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>Les rattachements, et comment ils ont été validés</h2>
        <p>Chaque rattachement est enregistré avec sa méthode, du plus sûr au moins sûr ; la page de chaque scrutin l'indique.</p>
        <ul>
          <li>
            <strong>Texte voté</strong> : référence publiée dans le scrutin ou dans le dossier ; à défaut, dossier de l'amendement mis aux voix, puis séance et
            intitulé du texte.
          </li>
          <li>
            <strong>Amendement mis aux voix</strong> : séance et numéro dans l'archive des amendements. L'archive de 2022-2024 étant illisible sur le serveur de
            l'Assemblée, chaque amendement a été récupéré individuellement, en reconstruisant son identifiant à partir des textes du dossier ; un document n'est
            retenu que si sa séance de discussion est celle du scrutin. Cette méthode a d'abord été validée sur 8 006 amendements de 2024-2026 dont l'identifiant
            est connu (identifiant juste toujours parmi les candidats), puis sur un échantillon de 40 scrutins de 2022-2024 (39 retrouvés), avant d'être
            généralisée. Plusieurs textes pouvant être examinés dans la même séance avec des numéros identiques, l'amendement retenu doit aussi appartenir au
            texte du scrutin, avoir un sort cohérent avec le résultat et, quand l'intitulé cite un député, l'avoir pour auteur ou cosignataire : aucun
            amendement affiché plutôt qu'un faux (version 1.1.0).
          </li>
          <li>
            <strong>Texte visé par une motion de censure</strong> (49.3) : référence publiée par l'Assemblée ; sinon, engagement de responsabilité débattu dans la
            séance du vote (méthode validée : 9 résultats identiques sur 9 cas connus, et abstention dans les 2 cas ambigus) ; en dernier recours, engagement le
            plus proche en date, affiché « probablement ».
          </li>
          <li>
            <strong>Thème</strong> : mots-clés du titre du dossier, sinon commission saisie au fond. Classement automatique, relu sur les 70 textes les plus votés.
          </li>
        </ul>

        <h2>La carte des votes</h2>
        <p>
          Pour chaque paire de députés, on calcule la part des scrutins disputés où ils ont voté différemment. Une méthode statistique classique, le
          positionnement multidimensionnel, place ensuite les points pour que leurs distances reproduisent au mieux ces désaccords. Seuls les députés ayant voté
          au moins 100 fois figurent sur la carte. Les axes n'ont pas d'unité : la carte est seulement tournée pour placer LFI à gauche, le RN à droite et
          Renaissance en haut.
        </p>

        <h2>Participation et vote avec son groupe</h2>
        <p>
          La participation est la part des scrutins tenus pendant le mandat du député (hors motions de censure) où il a voté pour, contre ou abstention. Les
          périodes où un député était ministre ne sont pas comptées. Beaucoup de scrutins ont lieu la nuit ou pendant des réunions de commission : une
          participation faible ne mesure pas le travail d'un député.
        </p>

        <h2 id="quiz">Le quiz</h2>
        <p>
          Le <a href={href({ page: "quiz" })}>quiz</a> fait voter sur de vrais scrutins, puis compare les réponses aux positions des groupes, calculées comme partout
          sur le site. Seule la formulation des questions est rédigée à la main (fichier <code>pipeline/quiz.toml</code>), selon des règles vérifiées
          automatiquement à chaque mise à jour (contrôles Q1 à Q7) :
        </p>
        <ul>
          <li>une question = un scrutin public où au moins un groupe a voté pour et un autre contre, de préférence un vote décisif ;</li>
          <li>la mesure votée est décrite en mots simples, sans nom de parti ni de député, sans jugement de valeur ; le résultat et l'origine du texte ne sont révélés qu'après la réponse ;</li>
          <li>« pour » signifie toujours « pour la mesure décrite » ; quand le scrutin portait sur un amendement qui la supprimait, le sens est inversé et signalé ;</li>
          <li>20 questions sont tirées au hasard en couvrant tous les thèmes choisis ;</li>
          <li>
            accord avec un groupe : 1 point si même position, ½ point s'il s'est abstenu, 0 sinon ; la marge affichée est un intervalle de confiance à 90 %
            (Wilson), qui décrit l'incertitude due au tirage des questions : environ ± 17 points avec 20 réponses.
          </li>
        </ul>
        <QuizBalance />

        <h2>Les conclusions tiennent-elles ? Analyse de sensibilité</h2>
        <p>
          Un résultat ne doit pas dépendre d'une définition arbitraire. Le taux d'accord est recalculé selon six définitions ; on vérifie que le classement des
          groupes reste le même (corrélation de rang : 1 = classement identique).
        </p>
        {sens.data ? <SensitivityBlock sens={sens.data} /> : <Loading label="Chargement de l'analyse…" />}

        <h2>Contrôles automatiques</h2>
        <p>
          À chaque mise à jour, la chaîne de traitement vérifie ses propres résultats, étape par étape. Un contrôle en échec bloque la publication. Les « écarts
          connus » sont expliqués.
        </p>
        {checks.data ? <ChecksBlock checks={checks.data} /> : <Loading label="Chargement des contrôles…" />}
        <p>
          En plus de ces contrôles, les décomptes par groupe de 50 scrutins tirés au hasard ont été comparés à la main aux pages officielles : 49 sont
          identiques. Dans le dernier (<a href={href({ page: "scrutin", leg: 17, num: 9 })}>scrutin n° 9</a> de la 17e législature), la page web et le fichier
          de données de l'Assemblée rangent trois députés dans des groupes différents ; nous suivons le fichier.
        </p>

        <h2>Corrections apportées aux données sources</h2>
        <ul>
          <li>146 groupes publiés sans identifiant : retrouvés grâce à l'appartenance de leurs votants à la date du scrutin.</li>
          <li>4 décomptes publiés diffèrent d'une voix de la liste nominative : la liste nominative fait foi.</li>
          <li>Les anciens ministres revenus à l'Assemblée ont un mandat daté du jour de l'élection : nous utilisons leur date de reprise de fonction.</li>
          <li>Les « mises au point » (un député déclare après coup avoir voulu voter autrement) ne changent pas le résultat officiel et ne sont pas prises en compte.</li>
        </ul>

        <h2>Hypothèses testées et écartées</h2>
        <ul>
          <li>
            Apparier les motions de censure aux scrutins par ordre de dépôt : écarté, des numéros manquent et le contrôle par les signataires donne de nombreux
            désaccords.
          </li>
          <li>
            Rattacher une motion au dernier engagement de responsabilité par la date : écarté comme méthode principale après des erreurs constatées (les trois
            motions du 24 octobre 2022 portaient sur le budget de l'État, pas sur celui de la sécurité sociale).
          </li>
        </ul>

        <h2>Ce que ce site ne dit pas</h2>
        <ul>
          <li>Tous les scrutins pèsent pareil : un amendement de détail compte autant que le vote final d'une loi (d'où les filtres « Votes finaux » et « Grands votes »).</li>
          <li>Le taux dépend de ce qui est mis au vote : un groupe qui dépose beaucoup d'amendements rejetés par tous paraît éloigné de tous.</li>
          <li>Voter pareil ne veut pas dire être allié : deux oppositions peuvent rejeter un texte pour des raisons contraires.</li>
        </ul>

        <h2>Sources et versions</h2>
        <p>
          Chaque archive utilisée est identifiée par son empreinte SHA-256 : en téléchargeant les mêmes fichiers, vous obtenez les mêmes résultats.
        </p>
        {sources.data ? <SourcesBlock sources={sources.data} /> : <Loading label="Chargement des sources…" />}

        <h2>Reproduire, réutiliser, citer</h2>
        <p>
          Le code est publié sous licence MIT, les données dérivées sous Licence Ouverte 2.0. La méthode complète (<code>METHODOLOGIE.md</code>), le dictionnaire
          des données (<code>DONNEES.md</code>) et le journal des versions accompagnent le code.
          {!IS_ARTIFACT && (
            <>
              {" "}
              Les positions de chaque groupe à chaque scrutin sont téléchargeables : <a href="data/exports/positions-groupes.csv">positions-groupes.csv</a>.
            </>
          )}
        </p>
        <p className="quote">
          Je vote qui&nbsp;?, d'après les données ouvertes de l'Assemblée nationale, méthode version {version}, données du {fmtDate(m.generated.slice(0, 10))}.
        </p>
      </article>
    </div>
  );
}

function CoverageBlock({ cov }: { cov: Coverage }) {
  return (
    <>
      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr>
              <th>Législature</th>
              <th>Scrutins</th>
              <th>Numéros manquants</th>
              <th>Rattachés à un texte</th>
              <th>Amendements : contenu retrouvé</th>
            </tr>
          </thead>
          <tbody>
            {cov.legislatures.map((l) => (
              <tr key={l.legislature}>
                <td>
                  {l.legislature}e ({fmtDate(l.premier)} – {fmtDate(l.dernier)})
                </td>
                <td>{fmtInt(l.scrutins)}</td>
                <td>{l.n_numeros_manquants}</td>
                <td>{fmtPct(l.scrutins_avec_dossier / l.scrutins)}</td>
                <td>
                  {fmtPct(l.amendements_retrouves / Math.max(1, l.scrutins_amendement))}{" "}
                  <span className="muted">
                    ({fmtInt(l.amendements_retrouves)} / {fmtInt(l.scrutins_amendement)})
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr>
              <th>Année</th>
              <th>Scrutins</th>
              <th>dont solennels</th>
              <th>dont amendements</th>
              <th>Contenu d'amendement retrouvé</th>
            </tr>
          </thead>
          <tbody>
            {cov.annees.map((a) => (
              <tr key={a.annee}>
                <td>{a.annee}</td>
                <td>{fmtInt(a.scrutins)}</td>
                <td>{fmtInt(a.solennels)}</td>
                <td>{fmtInt(a.amendements)}</td>
                <td>{fmtPct(a.amendements_retrouves / Math.max(1, a.amendements))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SensitivityBlock({ sens }: { sens: Sensitivity }) {
  const core = useCore();
  const [ref, setRef] = React.useState("REN");
  const others = sens.familles.filter((f) => f !== ref && sens.taux[`${f}|${ref}`]?.[0] != null);
  const rows = others
    .map((f) => ({ f, t: sens.taux[`${f}|${ref}`], n: sens.n[`${f}|${ref}`] }))
    .sort((a, b) => (b.t[0] ?? 0) - (a.t[0] ?? 0));
  const short = ["Référence", "Demi-abstention", "Sans abstention", "Disputés", "Votes finaux", "Poids par texte"];
  return (
    <div className="stack">
      <label className="ctl">
        <span>Accord avec</span>
        <select className="select" value={ref} onChange={(e) => setRef(e.target.value)}>
          {sens.familles.map((f) => (
            <option key={f} value={f}>
              {core.famById[f].short}
            </option>
          ))}
        </select>
      </label>
      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr>
              <th>Groupe</th>
              {short.map((s, k) => (
                <th key={s} title={sens.definitions[k]?.label}>
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.f}>
                <td>
                  <FamChip id={r.f} />
                </td>
                {r.t.map((v, k) => (
                  <td key={k} title={`${fmtInt(r.n[k])} scrutins`} style={r.n[k] < 30 ? { color: "var(--muted)" } : undefined}>
                    {fmtPct(v)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td>
                <strong>Stabilité du classement</strong>
              </td>
              <td>—</td>
              {(sens.stabilite[ref] ?? []).map((v, k) => (
                <td key={k}>
                  <strong>{v.toFixed(2).replace(".", ",")}</strong>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="note">
        Survolez un en-tête pour sa définition, une case pour le nombre de scrutins. Grisé : moins de 30 scrutins. « Poids par texte » : chaque texte pèse autant,
        quel que soit son nombre d'amendements, ce qui neutralise les textes très amendés.
      </p>
    </div>
  );
}

/** Écriture française des nombres produits par la chaîne : « 99.3% » → « 99,3 % », « 2021657 » → « 2 021 657 ». */
function frNumbers(text: string): string {
  return text
    .replace(/\b\d{5,}\b/g, (n) => fmtInt(+n))
    .replace(/(\d)\.(\d)/g, "$1,$2")
    .replace(/(\d)%/g, "$1\u202f%");
}

/** Équilibre des questions : un ensemble où un groupe vote presque toujours « pour » avantagerait
    les personnes qui répondent souvent « pour ». */
function QuizBalance() {
  const st = useAsync(loadQuiz, []);
  if (!st.data) return st.error ? null : <Loading label="Chargement du quiz…" />;
  const d = st.data;
  const fams = d.families.filter((f) => d.stats.balance[f]?.n);
  return (
    <div className="stack">
      <p>
        {d.stats.n} questions ({d.stats.legislatures["16"] ?? 0} de 2022-2024, {d.stats.legislatures["17"] ?? 0} depuis 2024), {Object.keys(d.stats.themes).length}{" "}
        thèmes, {d.stats.adopted} textes adoptés et {d.stats.n - d.stats.adopted} rejetés. Équilibre : part des questions où chaque groupe a voté pour la mesure
        (contrôle Q6 : entre 20 % et 80 %).
      </p>
      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr>
              <th>Groupe</th>
              <th>Pour la mesure</th>
              <th>Contre</th>
              <th>Abstention</th>
              <th>Part de « pour »</th>
            </tr>
          </thead>
          <tbody>
            {fams.map((f) => {
              const b = d.stats.balance[f];
              return (
                <tr key={f}>
                  <td>
                    <FamChip id={f} />
                  </td>
                  <td>{b.pour}</td>
                  <td>{b.contre}</td>
                  <td>{b.abstention}</td>
                  <td>{fmtPct(b.part_pour)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note">
        Formulations proposées le {fmtDate("2026-11-03")}, à relire par le comité éditorial du projet ; toute correction se propose comme une contribution
        (voir <code>CONTRIBUTING.md</code>).
      </p>
    </div>
  );
}

function ChecksBlock({ checks }: { checks: Check[] }) {
  return (
    <div className="scroll-x">
      <table className="table">
        <thead>
          <tr>
            <th>Contrôle</th>
            <th>Étape</th>
            <th>Résultat</th>
            <th>Valeur</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.id} title={c.detail}>
              <td style={{ whiteSpace: "normal", textAlign: "left" }}>
                <span className="mono tiny muted">{c.id}</span> {c.titre}
                {c.detail && (
                  <>
                    <br />
                    <span className="tiny muted">{frNumbers(c.detail)}</span>
                  </>
                )}
              </td>
              <td>{c.etape}</td>
              <td>
                {STATUT[c.statut].mark} {STATUT[c.statut].label}
              </td>
              <td>{frNumbers(String(c.valeur))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourcesBlock({ sources }: { sources: Record<string, SourceInfo> }) {
  return (
    <div className="scroll-x">
      <table className="table">
        <thead>
          <tr>
            <th>Archive</th>
            <th>Taille</th>
            <th>Publiée le</th>
            <th>Empreinte SHA-256</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(sources).map(([k, v]) => (
            <tr key={k}>
              <td style={{ textAlign: "left" }}>
                <a href={v.url} target="_blank" rel="noopener noreferrer">
                  {k}
                </a>
              </td>
              <td>{v.size ? `${fmtInt(Math.round(v.size / 1e6))} Mo` : "—"}</td>
              <td>{v.last_modified ? fmtDate(new Date(v.last_modified).toISOString().slice(0, 10)) : "—"}</td>
              <td className="mono tiny" title={v.sha256 ?? v.unavailable}>
                {v.sha256 ? `${v.sha256.slice(0, 16)}…` : v.unavailable ? "indisponible : complétée document par document" : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
