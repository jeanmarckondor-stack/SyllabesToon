# Banque de syllabes

La banque actuelle se concentre sur des syllabes simples de type consonne + voyelle.

## Principe

Toutes les syllabes disponibles sont declarees dans `src/config.js`.

Elles sont organisees par groupes:

- `starter`: premiere liste tres courte pour les premiers niveaux;
- `early`: liste elargie mais encore limitee;
- `core`: ensemble central de syllabes simples;
- `extended`: banque complete actuelle.

Le jeu utilise `extended` pour les distracteurs, mais chaque niveau choisit ses syllabes cibles dans un `targetPool` plus restreint.

## Banque actuelle

Consonnes actuellement couvertes:

- m: ma, me, mi, mo, mu;
- l: la, le, li, lo, lu;
- p: pa, pe, pi, po, pu;
- t: ta, te, ti, to, tu;
- b: ba, be, bi, bo, bu;
- s: sa, se, si, so, su;
- r: ra, re, ri, ro, ru;
- f: fa, fe, fi, fo, fu;
- n: na, ne, ni, no, nu;
- d: da, de, di, do, du;
- v: va, ve, vi, vo, vu.

## Ce qui n'est pas encore inclus

Pour eviter de complexifier trop vite, la banque n'inclut pas encore:

- les sons complexes: ch, ou, on, an, in;
- les syllabes inverses: ar, ol, is;
- les syllabes avec consonnes doubles ou groupes consonantiques: pra, tri, blo;
- les mots complets.

Ces contenus pourront etre ajoutes plus tard comme nouveaux groupes, quand les premiers usages auront ete observes.

## Ajouter une syllabe

1. Ajouter la syllabe dans le bon groupe de `src/config.js`.
2. Ajouter le fichier audio correspondant dans `assets/audio/syllables`.
3. Tester le fichier dans `audio-check.html`.
4. Ajouter la syllabe dans un `targetPool` seulement si elle doit devenir une cible d'exercice.
