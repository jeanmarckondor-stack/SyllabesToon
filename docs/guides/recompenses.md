# Recompenses et encouragements

L'objectif des recompenses est de donner de l'energie a l'enfant sans transformer l'erreur en echec.

## Principes retenus

- Varier les encouragements pour eviter la repetition mecanique.
- Valoriser l'ecoute, la recherche, l'effort et la perseverance.
- Donner une recompense courte a la fin d'une manche.
- Garder un retour doux et non punitif en cas d'erreur.
- Eviter les sons agressifs, les pertes de points et les ecrans d'echec.

## Recompense de fin de manche

Quand toutes les syllabes cibles sont trouvees:

- une capsule surprise apparait;
- une mini-scene animee se joue au centre de l'ecran;
- un son court est joue;
- la mascotte celebre;
- la recompense disparait ensuite sans etre capitalisee dans un coin de l'ecran.

Le fichier image principal est:

`assets/images/reward-capsule.png`

## Types de messages

Les messages sont definis dans `src/config.js`:

- `encouragements`: bonnes reponses ordinaires;
- `firstTryMessages`: reussites rapides sans erreur;
- `comebackMessages`: reussites apres une erreur;
- `gentleHelps`: aide douce apres une mauvaise reponse;
- `completionMessages`: fin de manche.

## Types de mini-scenes

Les recompenses sont definies dans `src/config.js`, dans `rewardShows`.

Chaque mini-scene contient:

- `id`;
- `name`;
- `message`;
- `tone`;
- `className`.
- `symbols`.

Les sons sont generes localement par `src/audio.js`. Aucun fichier son de recompense n'est necessaire pour cette premiere version.

Mini-scenes actuelles:

- danse des etoiles;
- fusee de la reussite;
- fete des bulles;
- vague arc-en-ciel;
- projecteur toon;
- pop de confettis;
- nuage calin;
- portail magique.

## Pistes futures

- Ajouter de vrais sons enregistres ou musicaux.
- Ajouter de courtes videos ou animations exportees.
- Remplacer certaines mini-scenes CSS par de vrais assets illustres.
- Adapter les recompenses selon l'univers Candy, Toon ou Manga.
- Debloquer une petite animation speciale apres plusieurs manches reussies.
