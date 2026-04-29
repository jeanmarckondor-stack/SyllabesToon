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

Ouvrir simplement [index.html](index.html) dans un navigateur.

La voix utilise provisoirement la synthese vocale du navigateur pour permettre un test immediat. Les futurs enregistrements humains seront places dans `assets/audio`.

Les fichiers de syllabes enregistrees doivent etre places dans `assets/audio/syllables`, par exemple `ma.mp3`, `la.mp3`, `pi.mp3`.

Pour tester les enregistrements sans lancer une partie, ouvrir [audio-check.html](audio-check.html).
