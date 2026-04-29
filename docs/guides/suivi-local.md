# Suivi local des séances

Le prototype enregistre un suivi simple dans le navigateur, avec `localStorage`.

## Données enregistrées

A chaque manche terminee, l'application sauvegarde:

- le prenom saisi;
- le niveau joue;
- le nom du niveau;
- la syllabe cible;
- le nombre de bonnes syllabes trouvees;
- le nombre d'erreurs;
- l'univers graphique utilise;
- la date et l'heure.

## Données non enregistrées

Pour cette version, l'application ne cree pas encore:

- de compte utilisateur;
- de fichier exportable;
- de synchronisation en ligne;
- de suivi nominatif partage entre plusieurs ordinateurs.

Les donnees restent dans le navigateur utilise.

## Voir le suivi

Dans le jeu, cliquer sur le bouton `Suivi`.

Le panneau affiche:

- le nombre total de manches;
- le nombre d'eleves vus sur ce navigateur;
- les syllabes qui ont genere le plus d'erreurs;
- les dernieres manches terminees.

## Effacer le suivi

Le bouton `Effacer le suivi local` supprime les donnees enregistrees dans ce navigateur.

Cette fonction est utile pour repartir de zero apres des tests.
