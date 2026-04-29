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
- un sticker virtuel est gagne;
- un son court est joue;
- la mascotte celebre;
- la collection des derniers stickers est mise a jour.

Le fichier image principal est:

`assets/images/reward-capsule.png`

## Types de messages

Les messages sont definis dans `src/config.js`:

- `encouragements`: bonnes reponses ordinaires;
- `firstTryMessages`: reussites rapides sans erreur;
- `comebackMessages`: reussites apres une erreur;
- `gentleHelps`: aide douce apres une mauvaise reponse;
- `completionMessages`: fin de manche.

## Types de stickers

Les stickers sont definis dans `src/config.js`, dans `rewards`.

Chaque reward contient:

- `id`;
- `name`;
- `symbol`;
- `tone`;
- `className`.

Les sons sont generes localement par `src/audio.js`. Aucun fichier son de recompense n'est necessaire pour cette premiere version.

## Pistes futures

- Ajouter de vrais sons enregistres ou musicaux.
- Remplacer les stickers CSS par de vrais assets illustres.
- Adapter les recompenses selon l'univers Candy, Toon ou Manga.
- Ajouter une collection plus visible en fin de seance.
- Debloquer une petite animation speciale apres plusieurs manches reussies.
