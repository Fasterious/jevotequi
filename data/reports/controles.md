# Contrôles automatiques

| Contrôle | Étape | Statut | Valeur | Attendu | Détail |
|---|---|---|---|---|---|
| E1 Numérotation des scrutins continue (aucun scrutin manquant) | extraction | ok | 0 | 0 |  |
| E2 Aucun député compté deux fois dans un même scrutin | extraction | ok | 0 | 0 | 2059814 votes nominatifs |
| E3 Tous les votants sont des députés connus | extraction | ok | 0 | 0 |  |
| E4 Décompte nominatif = décompte publié, groupe par groupe | extraction | alerte | 4 | ≤ 20 écarts connus | VTANR5L16V1927 PO800502; VTANR5L16V1929 PO800502; VTANR5L16V1930 PO800502; VTANR5L16V1948 PO800502 (la liste nominative fait foi) |
| E5 Somme des votes nominatifs = résultat officiel du scrutin | extraction | alerte | 4 | ≤ 20 | VTANR5L16V1927; VTANR5L16V1929; VTANR5L16V1930; VTANR5L16V1948 |
| E6 Groupes publiés sans identifiant : tous retrouvés | extraction | ok | 0 | 0 | 146 groupes corrigés (identifiant « PO0 » dans la source) |
| E7 Jamais plus de 577 députés en fonction à une même date | extraction | ok | 577 | ≤ 577 | maximum le 2022-07-11 (dates de reprise de fonction des anciens ministres prises en compte) |
| L1 Scrutins rattachés à un dossier législatif | rapprochement | ok | 99.5% | ≥ 95 % | 67 scrutins sans dossier (motions de censure spontanées, déclarations…) |
| L2-16 Contenu des amendements retrouvé (16e législature) | rapprochement | ok | 99.2% | ≥ 90 % | 3147 sur 3173 scrutins d'amendement |
| L2-17 Contenu des amendements retrouvé (17e législature) | rapprochement | ok | 99.7% | ≥ 90 % | 8540 sur 8564 scrutins d'amendement |
| L3 Type de vote reconnu | rapprochement | ok | 0 | ≤ 0,1 % « autre » |  |
| L4 Thème attribué | rapprochement | ok | 0 | ≤ 1 % « autres » |  |
| L5 Numéro de l'amendement retrouvé = numéro cité par le scrutin | rapprochement | ok | 0 | 0 |  |
| L6 Amendement affiché et scrutin rattachés au même texte | rapprochement | ok | 0 | 0 | corrections appliquées — amendement retrouvé grâce aux autres scrutins du même texte : 1; dossier remplacé : 4; dossier retiré : 3; amendement d'un autre texte (même séance, même numéro) : 4 |
| L7 Rattachements par la séance confirmés (intitulé ou autres scrutins du même texte) | rapprochement | ok | 0 | 0 |  |
| L8 Auteur de l'amendement affiché = député cité par le scrutin (ou cosignataire) | rapprochement | ok | 0.19% | ≤ 0,5 % | 11211 confirmés sur 11232 ; écarts connus : l'intitulé cite parfois le député qui a défendu l'amendement plutôt que son premier signataire (numéro, séance, texte et sort concordent) — VTANR5L16V58, VTANR5L16V473, VTANR5L16V1058, VTANR5L16V1067, VTANR5L16V1072, VTANR5L16V1077 |
| K1 Valeurs de référence vérifiées sur le site de l'Assemblée | calcul | ok | 8/8 | 8/8 |  |
| K2 Positions de groupe valides (pour, contre, abstention, partagé, aucun vote) | calcul | ok | 0 | 0 |  |
| K3 Écart entre nos positions recalculées et le champ « position majoritaire » publié | calcul | alerte | 3304 |  | Le champ publié n'est pas utilisé : il vaut « pour » par défaut et contredit parfois les décomptes. |
| K4 Chaque député vote au plus autant de fois que de scrutins tenus pendant son mandat | calcul | ok | 0 | 0 |  |
| P1 Chaque fichier publié pèse moins de 15 Mo | publication | ok | 0 | 0 |  |
| Q1 Chaque question renvoie à un scrutin public existant | quiz | ok | 0 | 0 |  |
| Q2 Chaque question départage : au moins un groupe pour et un groupe contre | quiz | ok | 0 | 0 |  |
| Q3 Formulation : question de 160 caractères au plus, contexte présent, aucun nom de parti | quiz | ok | 0 | 0 |  |
| Q4 Amendements de suppression : sens de la question explicite | quiz | ok | 0 | 0 |  |
| Q5 Tous les thèmes sont couverts | quiz | ok | 0 | 0 | 37 questions, 15 thèmes |
| Q6 Équilibre : aucun groupe toujours « pour » ou toujours « contre » (entre 20 % et 80 %) | quiz | ok | 0 | 0 | GDR 53%, LFI 49%, ECO 59%, SOC 65%, LIOT 76%, DEM 63%, REN 60%, HOR 54%, LR 64%, UDR 56%, RN 61% |
| Q7 Pas deux questions sur le même scrutin | quiz | ok | 0 | 0 |  |
