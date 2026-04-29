# Cahier des charges - SyllabesToon

Statut: version de cadrage V1.

## 1. Vision du projet

SyllabesToon est une application web pedagogique et ludique destinee a des enfants de 5 a 7 ans scolarises en IME, presentant une deficience intellectuelle.

L'objectif du premier module est d'aider les enfants a reconnaitre des syllabes simples, a partir d'une consigne orale humaine, dans un nuage de syllabes affichees a l'ecran.

Le projet doit etre pense comme une application evolutive: le premier exercice doit etre solide, mais l'architecture devra permettre d'ajouter ensuite d'autres activites pedagogiques sans tout reconstruire.

## 2. Public cible

### Enfants

- Age: 5 a 7 ans.
- Scolarisation: IME.
- Besoins: consignes simples, temps de reponse souple, interactions evidentes, feedback immediat et bienveillant.
- Usage: individuel, avec un adulte a cote.
- Support: PC.

### Contraintes pedagogiques

- Ne pas mettre l'enfant en situation d'echec.
- Commencer par des situations tres simples.
- Proposer une progression lente, claire et rassurante.
- Soutenir l'attention par un univers graphique attractif, sans nuire a la lisibilite.
- Valoriser l'effort autant que la bonne reponse.

## 3. Positionnement technique initial

L'application sera construite comme une application web moderne.

Hypothese recommandee pour la V1:

- fonctionnement local et hors ligne au depart;
- architecture compatible avec une future mise en ligne;
- assets audio embarques dans le projet;
- utilisation sur PC avec souris;
- zones de clic larges pour permettre une utilisation simple;
- pas de compte utilisateur ni d'espace adulte dans la premiere version;
- structure prevue pour ajouter plus tard des profils enfants et un suivi individuel.

Le choix du hors ligne est recommande pour une premiere version en IME: fiabilite, independance au reseau, confidentialite et simplicite d'installation. La conception devra toutefois rester compatible avec une future version hebergee.

## 4. Premier module: Le Nuage des Syllabes

### Principe

L'enfant entend une syllabe prononcee par une voix humaine. Il doit retrouver cette syllabe dans un nuage contenant plusieurs syllabes affichees.

Le nuage contient:

- 1 a 3 occurrences de la syllabe cible selon le niveau;
- plusieurs distracteurs;
- des variations visuelles progressives selon la difficulte.

L'exercice se termine quand l'enfant a trouve toutes les bonnes occurrences.

### Deroulement d'une partie

1. L'ecran affiche un univers graphique toon et un nuage de syllabes.
2. Une consigne orale est jouee, par exemple: "Trouve ma".
3. Dans les premiers niveaux, la syllabe cible est aussi visible a l'ecran.
4. L'enfant clique sur les syllabes qu'il pense correctes.
5. Chaque bonne reponse declenche une gratification immediate.
6. Chaque erreur declenche une aide douce, jamais une sanction.
7. Quand toutes les syllabes cibles sont trouvees, une recompense courte clot l'exercice.

## 5. Audio

Les syllabes doivent etre prononcees par une voix humaine.

Pour la V1:

- utiliser des fichiers audio preenregistres;
- prevoir que ces fichiers puissent etre enregistres par l'enseignante ou l'adulte qui utilise l'application avec les enfants;
- prevoir un bouton tres visible pour reecouter la syllabe;
- prevoir une consigne orale complete au debut, puis la syllabe seule;
- permettre a terme d'ajouter facilement de nouvelles syllabes audio.

La synthese vocale n'est pas l'option privilegiee pour ce projet, car une voix humaine est plus chaleureuse, plus stable et plus adaptee au public vise.

Pour le prototype, la synthese vocale du navigateur peut etre utilisee temporairement afin de tester rapidement les interactions. Elle devra ensuite etre remplacee par une banque de sons personnalisee.

## 6. Progression de difficulte

La difficulte doit augmenter tres progressivement. Plusieurs leviers peuvent etre combines, mais pas tous en meme temps au debut.

### Nombre total de syllabes

- Niveau tres facile: 3 syllabes visibles.
- Puis 5, 8, 12, 16 ou plus selon les capacites.

### Nombre de bonnes reponses

- Debut: 1 occurrence a trouver.
- Puis 2 occurrences.
- Puis 3 occurrences.

### Proximite des distracteurs

C'est un levier pedagogique majeur.

Au debut, les distracteurs doivent etre tres differents:

- cible: ma;
- distracteurs possibles: lo, pi, tu.

Plus tard, les distracteurs peuvent devenir proches visuellement ou auditivement:

- cible: ma;
- distracteurs possibles: mi, mo, pa, na.

### Stabilite visuelle

Progression possible:

1. meme police, meme taille, meme orientation;
2. tailles legerement differentes;
3. couleurs differentes;
4. rotations legeres;
5. polices differentes;
6. positions plus rapprochees;
7. nuage plus dense.

### Affichage de la cible

- Premiers niveaux: l'enfant entend et voit la syllabe cible.
- Niveaux suivants: la cible reste visible mais moins centrale.
- Plus tard: l'enfant entend seulement la syllabe.

### Aides adaptatives

Si l'enfant se trompe ou reste bloque, l'application peut:

- repeter la syllabe;
- rejouer la consigne;
- grossir legerement une bonne reponse;
- faire scintiller doucement une bonne reponse;
- reduire le nombre de distracteurs;
- proposer une phrase reconfortante;
- remettre l'enfant en situation de reussite.

### Temps

La V1 ne doit pas imposer de limite de temps. Un mode defi pourra etre envisage plus tard, mais il ne doit pas etre central pour ce public.

## 7. Pedagogie positive et feedback

La regle centrale: une erreur n'est jamais traitee comme un echec.

### Bonne reponse

Feedback possible:

- animation courte;
- etoile;
- personnage content;
- son joyeux;
- mini-musique;
- autocollant virtuel;
- effet de lumiere autour de la syllabe trouvee.

Les encouragements devront etre varies. L'application ne doit pas se limiter a "Bravo": elle devra proposer plusieurs formulations positives, des effets visuels differents et, a terme, des sons ou petites musiques de recompense.

### Mauvaise reponse

Feedback possible:

- message oral doux;
- animation rassurante;
- repetition de la syllabe;
- encouragement du type "On reessaie";
- indice visuel progressif.

Il faut eviter:

- buzzer d'erreur;
- croix rouge agressive;
- perte de points;
- chronometre stressant;
- ecran d'echec.

## 8. Direction artistique

Le style doit etre fortement cartoon, tres colore, expressif et actuel, tout en restant lisible.

Intentions:

- univers visuel "toon" tres marque, avec une energie proche cartoon/manga;
- couleurs joyeuses et contrastees;
- formes arrondies, gonflees, brillantes;
- effets visuels qui flashent de facon courte et lisible;
- personnages ou mascottes expressives;
- decors varies pour que plusieurs enfants puissent s'y retrouver;
- polices rondes, ludiques, enfantines, mais tres lisibles;
- animations courtes et gratifiantes.

Il faudra garder un equilibre entre un rendu "bluffant" et l'objectif pedagogique. Les syllabes doivent toujours rester parfaitement lisibles.

Reference d'intention: un rendu tres vivant, brillant, arrondi, proche de certains univers cartoon expressifs et exageres, sans perdre la clarte pedagogique.

### Univers graphiques possibles

Deux familles visuelles doivent etre conservees comme principe durable du projet:

- un univers doux, cartoon, rond et rassurant, pour les enfants calmes ou facilement brusques par une stimulation trop forte;
- un univers plus manga/energie, plus contrasté et stimulant, pour les enfants qui ont besoin de signaux visuels plus frequents et plus dynamiques.

Ces univers doivent pouvoir etre selectionnes sans changer l'exercice pedagogique.

Autres variations possibles a terme:

- monde bonbon;
- jungle douce;
- espace cartoon;
- ocean colore;
- fete foraine;
- petits personnages rigolos;
- atelier magique;
- ville jouet.

Ces themes seront a affiner selon les assets disponibles et les preferences des enfants.

La version definitive devra utiliser de vrais assets illustres: fonds, mascottes, recompenses, stickers, effets visuels et eventuellement petites animations. Le CSS seul peut servir au prototypage, mais ne doit pas etre la limite graphique finale.

Les univers graphiques doivent rester faciles a remplacer. Chaque univers correspond a un fichier de fond et a une configuration simple, par exemple:

- `assets/images/soft-cartoon-bg.png` pour l'univers Candy;
- `assets/images/toon-classic-bg.png` pour l'univers Toon;
- `assets/images/manga-energy-bg.png` pour l'univers Manga.

Ces images pourront etre retravaillees plus tard dans d'autres logiciels, puis reintegrees dans l'application en conservant les memes noms de fichiers ou en mettant a jour une configuration centrale.

La mascotte doit devenir un element actif de l'interaction: elle peut afficher le prenom de l'enfant sur un panneau, bouger differemment selon les reponses, celebrer les reussites et accompagner les erreurs de maniere reconfortante.

## 9. Ergonomie

Pour la V1:

- premier ecran directement jouable;
- peu de texte;
- consignes orales;
- gros bouton de relecture audio;
- gros boutons de navigation;
- cartes syllabes tres claires;
- zones cliquables larges;
- aucune surcharge autour des syllabes;
- interface utilisable avec un adulte accompagnant;
- pas de menu adulte complexe au debut.

L'interface devra distinguer clairement:

- l'espace de jeu enfant;
- les controles simples utiles a l'adulte, si necessaire.

## 10. Donnees et suivi

La V1 ne necessite pas encore l'enregistrement des resultats individuels.

L'architecture devra toutefois prevoir:

- une saisie simple du prenom au demarrage de la seance;
- une future notion de profil enfant;
- un historique de seances;
- un suivi des syllabes reussies ou difficiles;
- une progression par niveaux;
- une sauvegarde locale dans un premier temps;
- une possible synchronisation en ligne plus tard.

Dans le prototype actuel, un premier suivi local peut etre enregistre dans le navigateur: prenom, niveau, syllabe cible, erreurs et date. Ce suivi reste volontairement simple et pourra servir de base a un futur espace adulte plus complet.

## 11. Architecture attendue

Le projet doit etre maintenable et extensible.

Principes:

- separer les donnees pedagogiques du code;
- decrire les niveaux par configuration;
- centraliser la banque de syllabes;
- centraliser la gestion audio;
- creer des composants reutilisables;
- preparer l'ajout de futurs modules.

Blocs fonctionnels a prevoir:

- moteur d'exercice;
- systeme de niveaux;
- banque de syllabes;
- banque audio;
- composants de cartes syllabes;
- systeme de feedback;
- systeme de recompenses;
- gestion des assets visuels;
- future couche de suivi des resultats.

## 12. Exemples de futurs exercices

Apres le Nuage des Syllabes, l'application pourra integrer:

- associer une syllabe entendue a une image;
- reconstruire un mot avec deux syllabes;
- trouver l'intrus;
- ecouter deux syllabes et choisir leur ordre;
- memory sonore;
- loto des syllabes;
- tri de syllabes;
- association syllabe / mot simple.

## 13. Perimetre recommande pour le premier prototype

Le premier prototype doit rester volontairement restreint mais tres soigne.

Objectif:

- une page web jouable;
- un exercice complet du Nuage des Syllabes;
- une petite liste de syllabes simples;
- quelques niveaux de difficulte;
- audio humain integre ou structure prete a recevoir les fichiers;
- feedback positif et feedback d'aide;
- univers graphique toon convaincant;
- code structure pour evoluer.

### Premier jeu de syllabes possible

Demarrage avec des syllabes tres simples et contrastees:

- ma;
- la;
- pi;
- to;
- bu;
- se.

Les syllabes proches comme pa/ba, ta/da, ma/na seront introduites plus tard.

## 14. Points a trancher avant implementation

Avant de coder la V1, il reste a choisir:

- la stack web exacte;
- le format des assets audio;
- les premieres polices;
- le premier univers graphique;
- la liste exacte des niveaux V1;
- la strategie de generation ou creation des visuels;
- la maniere de lancer l'application localement sur PC.

## 15. Decisions deja prises

- Application web.
- Utilisation sur PC.
- Public: enfants de 5 a 7 ans en IME avec deficience intellectuelle.
- Usage individuel avec adulte a cote.
- Premier module: reconnaissance de syllabes entendues dans un nuage.
- Voix humaine pour les syllabes.
- Pas d'acces adulte necessaire dans les premiers niveaux.
- Dans les premiers niveaux, l'enfant entend et voit la syllabe cible.
- Plus tard, la cible pourra etre uniquement entendue.
- Resultats individuels a prevoir dans l'architecture, mais pas a implementer immediatement.
- Style visuel: toon, tres colore, actuel, ludique.
- Pedagogie positive: aucune sanction, aide et reconfort en cas de difficulte.
- Recommandation initiale: application locale hors ligne, compatible avec une future version en ligne.
