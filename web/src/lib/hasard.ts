/* Choix par défaut neutres : quand une page a besoin d'un groupe de départ, il est tiré au hasard
   une fois par visite (gardé le temps de l'onglet), pour qu'aucun groupe ne soit mis en avant. */

export function groupeAuHasard(groupes: string[], cle: string, exclure?: string): string {
  const choix = groupes.filter((g) => g !== exclure);
  try {
    const garde = sessionStorage.getItem(cle);
    if (garde && choix.includes(garde)) return garde;
  } catch {
    /* stockage indisponible : nouveau tirage à chaque affichage, sans conséquence */
  }
  const g = choix[Math.floor(Math.random() * choix.length)];
  try {
    sessionStorage.setItem(cle, g);
  } catch {
    /* idem */
  }
  return g;
}
