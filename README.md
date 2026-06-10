# SyllabesToon

SyllabesToon est une application web pedagogique et ludique destinee a des enfants de 5 a 7 ans scolarises en IME.

Le premier module vise la reconnaissance de syllabes simples: l'enfant entend une syllabe prononcee par une voix humaine et doit retrouver ses occurrences dans un nuage de syllabes colore et accessible.

## Documents

- [Cahier des charges](docs/cahier-des-charges.md)
- [Guide audio et assets](docs/guides/audio-et-assets.md)
- [Guide de progression de difficulté](docs/guides/progression-difficulte.md)
- [Guide de la banque de syllabes](docs/guides/banque-syllabes.md)
- [Guide du suivi local](docs/guides/suivi-local.md)
- [Guide des récompenses](docs/guides/recompenses.md)

## Decisions de cadrage

- Application web utilisee sur PC.
- Usage individuel avec un adulte accompagnant.
- Fonctionnement local et hors ligne recommande pour la V1.
- Architecture compatible avec une future version en ligne.
- Style visuel toon, tres colore, avec polices ludiques et assets attractifs.
- Deux univers visuels a conserver: un mode doux/cartoon et un mode manga/energie.
- Les univers graphiques sont des images dans `assets/images`, remplacables sans changer la logique du jeu.
- La seance peut demarrer avec le prenom de l'eleve, affiche sur un panneau porte par la mascotte.
- Pedagogie positive: feedbacks encourageants, aucune sanction d'erreur.
- Voix humaine a terme, idealement enregistree par l'enseignante pour personnaliser l'application.
- Recompenses et encouragements varies, pas seulement un message unique.
- Resultats individuels prevus plus tard, mais non necessaires dans la premiere version.

## Prochaine etape

Valider le cahier des charges, puis choisir la stack technique et construire un premier prototype jouable du module "Nuage des Syllabes".

## Lancer le prototype

Depuis la racine du projet:

```bash
python -m http.server 8000
```

Jeu principal:
`http://localhost:8000/index.html`

Espace enseignant unique:
`http://localhost:8000/teacher-manager.html`

PIN temporaire enseignant: `1234`

Les anciennes pages enseignant `teacher-syllables.html` et `teacher-voice.html` ont ete supprimees. Toutes les actions enseignant passent par `teacher-manager.html`.

## Donnees locales

- Source de verite des syllabes: `localStorage` avec la cle `syllabestoon.syllables.v1`.
- Voix enseignante: `IndexedDB`.
- La synthese vocale du navigateur reste le fallback si aucune voix enseignante n'est disponible.

## Assets de recompense

Mettre a jour la liste des videos disponibles:

```bash
node scripts/update-videos-json.js
```

Mettre a jour la liste des sons disponibles:

```bash
node scripts/update-sounds-json.js
```

Pour tester les enregistrements de syllabes sans lancer une partie, ouvrir [audio-check.html](audio-check.html).
