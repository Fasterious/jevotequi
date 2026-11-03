import React from "react";
import { IS_ARTIFACT } from "../lib/data";

export const FILM = { titre: "À qui faire confiance ?", duree: "1 min 42" };

/** Le triangle de lecture, dessiné : le caractère ▶ s'affiche en émoji sur certains téléphones. */
export function IconeLecture() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M5 2.9v10.2a.7.7 0 0 0 1.07.6l8.1-5.1a.7.7 0 0 0 0-1.2l-8.1-5.1A.7.7 0 0 0 5 2.9z" fill="currentColor" />
    </svg>
  );
}

/** Le film de présentation. Une affiche cliquable : la vidéo ne se télécharge qu'au clic, jamais avant.
 *  Sous-titres activés par défaut (beaucoup regardent sans le son). `lancee` et `onLancer` laissent un bouton
 *  extérieur (« Voir le film ») la lancer. */
export function VideoPresentation({ lancee, onLancer }: { lancee?: boolean; onLancer?: () => void }) {
  const [lanceeIci, setLanceeIci] = React.useState(false);
  const enLecture = lancee ?? lanceeIci;
  if (IS_ARTIFACT) return null;
  return (
    <figure className="video-pres">
      {enLecture ? (
        <video controls autoPlay playsInline preload="auto" poster="video/affiche.jpg" width={1280} height={720}>
          <source src="video/presentation.mp4" type="video/mp4" />
          <track kind="captions" src="video/presentation.vtt" srcLang="fr" label="Français" default />
        </video>
      ) : (
        <button
          type="button"
          className="video-affiche"
          onClick={() => (onLancer ? onLancer() : setLanceeIci(true))}
          aria-label={`Voir le film « ${FILM.titre} », ${FILM.duree}`}
        >
          <img src="video/affiche.jpg" alt="" width={1280} height={720} />
          <span className="video-lire" aria-hidden="true">
            <span className="video-lire-rond">
              <IconeLecture />
            </span>
            <span className="video-lire-texte">
              Voir le film <span className="video-duree">{FILM.duree}</span>
            </span>
          </span>
        </button>
      )}
      <figcaption className="small muted">
        « {FILM.titre} » · {FILM.duree}, sous-titré. La vidéo ne se charge que si vous la lancez.
      </figcaption>
    </figure>
  );
}
