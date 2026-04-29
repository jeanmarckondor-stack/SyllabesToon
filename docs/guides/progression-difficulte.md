# Progression de difficulte

La progression doit rester tres graduelle. L'objectif n'est pas de rendre l'exercice difficile rapidement, mais d'ajouter un seul type d'obstacle a la fois quand l'enfant est pret.

## Critères utilisés

Les niveaux du prototype combinent plusieurs leviers:

- nombre total de syllabes affichees;
- nombre de bonnes occurrences a trouver;
- choix des syllabes cibles;
- distance entre la cible et les distracteurs;
- rotations;
- variations de taille;
- variations de police;
- densite du nuage;
- affichage ou non de la syllabe cible;
- indice visuel apres plusieurs erreurs.

## Progression actuelle

1. `Découverte`: tres peu de cartes, une cible, distracteurs tres differents.
2. `Petit nuage`: une carte de plus, toujours tres stable.
3. `Deux trésors`: deux occurrences de la cible, petites rotations.
4. `Formes folles`: davantage de variations visuelles.
5. `Même voyelle`: distracteurs proches par la voyelle.
6. `Même départ`: distracteurs proches par la consonne initiale.
7. `Trois étoiles`: trois occurrences a retrouver, nuage plus dense.
8. `Écoute seule`: la cible n'est plus affichee, elle est seulement entendue.
9. `Sons inversés`: introduction des syllabes voyelle + consonne, par exemple al, el, il, ol, ul.
10. `Grand mélange`: melange de syllabes consonne + voyelle et voyelle + consonne.

## Modes de distracteurs

- `far`: syllabes tres differentes de la cible.
- `mixed`: melange de syllabes variees.
- `sameVowel`: syllabes partageant la meme voyelle.
- `sameConsonant`: syllabes partageant la meme consonne de depart.
- `sameEnding`: syllabes partageant la meme consonne finale.
- `inverseFar`: syllabes inversees differentes de la cible.
- `near`: syllabes proches par la voyelle ou la consonne.

## Modifier ou ajouter un niveau

Les niveaux sont definis dans `src/config.js`, dans `levels`.

Pour ajouter un niveau, copier un bloc existant puis ajuster:

- `totalCards`;
- `targets`;
- `targetPool`;
- `rotations`;
- `sizes`;
- `fontVariants`;
- `distractorMode`;
- `colorVariety`;
- `density`;
- `showTarget`;
- `hintAfterMistakes`.

Les boutons de niveaux sont generes automatiquement: il n'est pas necessaire de modifier `index.html` pour ajouter un niveau.

## Rotation des syllabes cibles

Le jeu evite de redemander trop souvent la meme syllabe.

Pour chaque niveau:

- le `targetPool` est melange;
- les syllabes sont parcourues avant d'etre remelangees;
- les dernieres syllabes demandees sont temporairement evitees;
- plus le pool est grand, plus l'historique d'evitement est long.

Cela permet de garder une grande variete tout en conservant une part d'aleatoire.

## Stabilisation de l'expérience enfant

Les niveaux doivent rester confortables visuellement:

- les premiers niveaux utilisent une grille plus aeree;
- les niveaux denses utilisent davantage de colonnes pour eviter un nuage trop vertical;
- les cartes conservent une taille minimale pour rester faciles a cliquer;
- le nom du niveau reste visible pour l'adulte accompagnant;
- un indice visuel doux peut apparaitre apres plusieurs erreurs;
- les animations respectent le reglage systeme de reduction des mouvements.
