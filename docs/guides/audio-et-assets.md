# Guide audio et assets

Ce guide decrit comment remplacer progressivement les elements temporaires du prototype par des ressources personnalisees.

## Voix humaine des syllabes

Les syllabes enregistrees par l'enseignante doivent etre placees dans:

`assets/audio/syllables`

Convention de nommage:

- `ma.mp3`
- `la.mp3`
- `pi.mp3`
- `to.mp3`
- `bu.mp3`
- `se.mp3`

La banque actuelle contient davantage de syllabes. La liste complete est documentee dans `docs/guides/banque-syllabes.md`.

Formats acceptes par le prototype:

- `.mp3`
- `.wav`
- `.ogg`

Le jeu cherche d'abord un fichier audio humain. Si aucun fichier n'est trouve, il utilise provisoirement la voix du navigateur.

## Verifier les fichiers audio

Une page de verification est disponible:

`audio-check.html`

Elle liste toutes les syllabes declarees dans `src/config.js` et permet de tester les fichiers presents dans `assets/audio/syllables`.

Si un fichier est trouve et lisible, la page indique `OK`. Sinon, elle indique que le fichier est absent ou illisible et rejoue provisoirement la syllabe avec la voix du navigateur.

## Conseils d'enregistrement

- Enregistrer dans un endroit calme.
- Garder une voix chaleureuse et stable.
- Dire seulement la syllabe, sans bruit avant ou apres.
- Laisser un tres court silence au debut et a la fin.
- Utiliser le meme volume pour toutes les syllabes.
- Exporter de preference en `.mp3`.
- Garder les noms en minuscules, sans espace ni accent.

## Ajouter une syllabe

1. Ajouter le fichier audio dans `assets/audio/syllables`.
2. Ajouter la syllabe dans `src/config.js`, dans `syllables`.
3. Si elle doit apparaitre dans les premiers niveaux, l'ajouter aussi dans `starterSyllables`.

## Univers graphiques

Les fonds actuels sont places dans:

`assets/images`

Fichiers utilises:

- `soft-cartoon-bg.png`: univers Candy.
- `toon-classic-bg.png`: univers Toon.
- `manga-energy-bg.png`: univers Manga.
- `mascot.png`: mascotte principale.
- `student-sign.png`: pancarte tenue par la mascotte, sans texte.
- `reward-capsule.png`: capsule surprise de recompense.

Pour remplacer un univers, le plus simple est de retravailler l'image dans un logiciel externe, puis de sauvegarder le nouveau fichier avec le meme nom. L'application chargera automatiquement la nouvelle version.

Le prenom de l'eleve n'est pas integre dans l'image de pancarte: il est superpose par l'application. Il faut donc garder une zone centrale vide et lisible si `student-sign.png` est remplacee.

Si on veut ajouter un nouvel univers sans remplacer les anciens, il faudra:

1. ajouter l'image dans `assets/images`;
2. ajouter une entree dans `themes` dans `src/config.js`;
3. ajouter le bouton correspondant dans `index.html`;
4. ajouter la variable CSS du fond dans `src/styles.css`.
