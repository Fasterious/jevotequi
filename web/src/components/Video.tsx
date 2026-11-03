import React from "react";
import { IS_ARTIFACT } from "../lib/data";

/** Le film de présentation. Une affiche cliquable : la vidéo ne se télécharge qu'au clic, jamais avant.
 *  Sous-titres activés par défaut (beaucoup regardent sans le son). */
export function VideoPresentation({ titre = "Je vote qui ? en 1 minute 10" }: { titre?: string }) {
  const [lancee, setLancee] = React.useState(false);
  if (IS_ARTIFACT) return null;
  return (
    <figure className="video-pres">
      {lancee ? (
        <video controls autoPlay playsInline preload="auto" poster="video/affiche.jpg" width={1280} height={720}>
          <source src="video/presentation.mp4" type="video/mp4" />
          <track kind="captions" src="video/presentation.vtt" srcLang="fr" label="Français" default />
        </video>
      ) : (
        <button type="button" className="video-affiche" onClick={() => setLancee(true)} aria-label={`Lire la vidéo : ${titre}`}>
          <img src="video/affiche.jpg" alt="" width={1280} height={720} loading="lazy" />
          <span className="video-lire" aria-hidden="true">
            ▶
          </span>
        </button>
      )}
      <figcaption className="small muted">{titre}, sous-titrée. La vidéo ne se charge que si vous la lancez.</figcaption>
    </figure>
  );
}
