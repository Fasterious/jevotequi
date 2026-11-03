/* Avis des visiteurs : « aidez-nous à améliorer cet outil ».

   Trois canaux, du plus direct au plus simple :
   1. dans l'aperçu publié sur claude.ai, la base de données de la page (capacité `db`),
      pour le propriétaire et les personnes invitées à contribuer ;
   2. sur le site public, la fonction serveur /api/avis (ou l'adresse VITE_FEEDBACK_ENDPOINT),
      qui crée un ticket GitHub étiqueté avec le jeton du projet : le visiteur n'a pas besoin
      de compte GitHub (voir api/avis.js) ;
   3. sinon, rien n'est envoyé : la personne peut copier son avis.
   Aucun nom ni adresse n'est demandé ; les réponses au quiz ne sont jamais envoyées. */

export interface Feedback {
  modules: string[];
  message: string;
  profil: string;
  /** Page d'où l'avis a été donné (ancre), pour comprendre le contexte. */
  origine: string;
  date: string;
  version: string;
  /** Moment où le formulaire a été affiché (protection contre les envois automatiques). */
  t0?: number;
  /** Champ piège, invisible pour les humains : doit rester vide. */
  site?: string;
}

/** Ce que le canal renvoie : numéro du ticket et, si le suivi est public, son lien. */
export interface Receipt {
  numero?: number;
  url?: string;
}

export type Channel = { kind: "db" | "endpoint"; send: (f: Feedback) => Promise<Receipt> } | { kind: "none" };

export const MODULES: { id: string; label: string }[] = [
  { id: "programmes-votes", label: "Comparer les programmes aux votes passés" },
  { id: "promesses", label: "Savoir quelles promesses ont été tenues" },
  { id: "mon-depute", label: "Retrouver les votes de mon député" },
  { id: "candidats", label: "Comparer les candidats entre eux" },
  { id: "quiz-plus", label: "Plus de questions dans le quiz" },
  { id: "explications", label: "Des explications simples sur chaque texte" },
  { id: "autre", label: "Autre chose (précisez ci-dessous)" },
];

export const PROFILS = ["Électeur ou électrice", "Journaliste", "Enseignant, étudiant ou chercheur", "Élu ou collaborateur", "Autre"];

export const MAX_MESSAGE = 2000;

interface RuntimeDb {
  doc(path: string): {
    get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
    set(data: Record<string, unknown>): Promise<void>;
  };
}
interface RuntimeUser {
  id(): Promise<string | null>;
  can(name: string): Promise<boolean | null>;
}
interface Runtime {
  use(name: string): Promise<unknown>;
}

const ENDPOINT: string = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_FEEDBACK_ENDPOINT || "/api/avis";

let channelPromise: Promise<Channel> | null = null;

/** Canal disponible pour cette visite (résolu une fois). */
export function feedbackChannel(): Promise<Channel> {
  if (!channelPromise) channelPromise = resolveChannel();
  return channelPromise;
}

async function resolveChannel(): Promise<Channel> {
  const rt = (window as unknown as { claude?: Runtime }).claude;
  if (rt && typeof rt.use === "function") {
    try {
      const [db, user] = (await Promise.all([rt.use("db"), rt.use("user")])) as [RuntimeDb | null, RuntimeUser | null];
      if (db && user) {
        const [id, can] = await Promise.all([user.id(), user.can("data.write")]);
        if (id && can !== false) {
          return {
            kind: "db",
            // Un document par personne (avis/<identifiant>), qui garde ses 50 derniers envois.
            send: async (f) => {
              const ref = db.doc(`avis/${id}`);
              const snap = await ref.get();
              const old = snap.exists && Array.isArray(snap.data()?.envois) ? (snap.data()!.envois as Feedback[]) : [];
              const { t0: _t0, site: _site, ...kept } = f;
              await ref.set({ envois: [...old, kept].slice(-50) });
              return {};
            },
          };
        }
      }
    } catch {
      /* capacité indisponible : canal suivant */
    }
  }
  // Dans l'aperçu claude.ai, une adresse extérieure est bloquée : pas de canal « adresse » là.
  if (ENDPOINT && !(rt && typeof rt.use === "function")) {
    return {
      kind: "endpoint",
      send: async (f) => {
        const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
        if (!r.ok) {
          const e = new Error(`envoi refusé (${r.status})`) as Error & { status?: number };
          e.status = r.status;
          throw e;
        }
        const j = (await r.json().catch(() => ({}))) as Receipt;
        return { numero: typeof j.numero === "number" ? j.numero : undefined, url: typeof j.url === "string" && j.url.startsWith("https://github.com/") ? j.url : undefined };
      },
    };
  }
  return { kind: "none" };
}

/** Texte lisible de l'avis, pour le copier quand l'envoi n'est pas possible. */
export function feedbackText(f: Feedback): string {
  const mods = f.modules.map((m) => MODULES.find((x) => x.id === m)?.label ?? m);
  return [
    "Avis sur « Je vote qui ? »",
    mods.length ? `Ce qui me serait utile : ${mods.join(" ; ")}` : "",
    f.message ? `Message : ${f.message}` : "",
    f.profil ? `Je suis : ${f.profil}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
