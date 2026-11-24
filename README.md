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

Lancement recommande sur PC de developpement:

```bash
start-syllabestoon.bat
```

Ce lanceur requiert encore Node.js sur le PC. La version enseignante portable sans Node viendra dans une prochaine etape.

Commande directe equivalente:

```bash
node scripts/serve.js
```

Cette commande regenere automatiquement `assets/videos/videos.json` et `assets/audio/rewards/sounds.json` avant de lancer le serveur local.

Fallback de developpement:

```bash
python -m http.server 8000
```

Jeu principal:
`http://localhost:8000/index.html`

Espace enseignant unique:
`http://localhost:8000/teacher-manager.html`

PIN temporaire enseignant: `1234`

Les anciennes pages enseignant `teacher-syllables.html` et `teacher-voice.html` ont ete supprimees. Toutes les actions enseignant passent par `teacher-manager.html`.

## Version portable enseignante

Le dossier `portable/` prepare la future version Windows sans installation de Node ni Python.

Il contient pour l'instant:

- `Lancer SyllabesToon.bat`: lanceur double-clic prevu pour l'enseignante.
- `README_ENSEIGNANTE.txt`: notice courte d'utilisation.

`server.exe` n'est pas encore fourni dans cette slice. Il faudra choisir puis ajouter un petit serveur Windows portable dans `portable/` avant de creer un dossier transmissible a l'enseignante.

## Compiler le serveur portable

Prerequis sur le PC de developpement uniquement: Go.

Compiler le mini serveur Windows:

```bash
go build -o portable/server.exe ./tools/server
```

Le PC de l'enseignante n'a pas besoin de Go. Il utilisera seulement `portable/server.exe` avec `portable/Lancer SyllabesToon.bat`.

Preparer le dossier portable complet:

```bash
node scripts/prepare-portable.js
```

Ordre recommande avant transfert:

1. Compiler `portable/server.exe`.
2. Lancer `node scripts/prepare-portable.js`.
3. Zipper le dossier `portable/`.

## Preparer la distribution Linux

Avec le binaire Linux x64 deja compile dans `portable-linux/server`, lancer depuis le PC de developpement:

```bash
node scripts/prepare-portable-linux.js
```

Le script regenere les manifests, copie les deux pages, `src/` et `assets/`, et remplace les anciens fichiers de ces dossiers. Il preserve `server`, verifie les chemins des medias pour Linux et ne touche pas a `portable/` Windows. Les exports de configuration et de voix ne sont pas inclus.

Node est necessaire uniquement pour cette preparation. Aucun ZIP n'est cree.

Sous Xubuntu, ouvrir un terminal dans `portable-linux/`, puis lancer:

```bash
chmod +x server lancer-syllabestoon.sh
./lancer-syllabestoon.sh
```

Le lanceur utilise Bash, `ss` et `xdg-open`, attend la reponse du serveur puis ouvre le jeu. Garder ce terminal ouvert pendant l'utilisation; Ctrl+C ou la fermeture du terminal arrete le serveur lance. Fermer uniquement le navigateur ne l'arrete pas. Si l'ouverture automatique echoue, ouvrir manuellement `http://localhost:8000/index.html`.

Node, Python et Go ne sont pas necessaires sur le PC Linux. Le lancement complet reste a valider sous Xubuntu.

Pour installer le raccourci bureau une premiere fois, placer le dossier de l'application a son emplacement definitif puis ouvrir un terminal dans `portable-linux/`:

```bash
bash installer-raccourci.sh
```

Double-cliquer ensuite sur `SyllabesToon` sur le bureau. Le raccourci ouvre un terminal et lance l'application. Si Xubuntu signale un lanceur non fiable, accepter de lui faire confiance ou de le rendre executable; au besoin, ouvrir ses proprietes, onglet Permissions, et autoriser son execution. Le script tente ce marquage automatiquement lorsqu'il est disponible.

Relancer l'installateur apres un deplacement du dossier: il met a jour le meme raccourci sans en creer de copie. Le script de preparation conserve `server`, `lancer-syllabestoon.sh` et `installer-raccourci.sh`.

## APK Android de test

Avec Node et le SDK Android configures sur le PC de developpement, lancer depuis la racine du projet:

```powershell
npm ci
npm run sync:android
cd android
.\gradlew.bat :app:assembleDebug
```

L'APK debug se trouve dans `android/app/build/outputs/apk/debug/app-debug.apk`.
Le build embarque les ressources web communes. L'identifiant `fr.syllabestoon.app`
et l'origine WebView `https://localhost` doivent rester stables pour les mises a jour.

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
