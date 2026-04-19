# Guide de contribution pour agent IA

## Objectif

Ce fichier définit comment un agent IA doit faire évoluer le code et la documentation d'architecture de ce dépôt.

Le principe central est simple:

- la documentation d'architecture doit rester utile pour comprendre la structure du système;
- elle ne doit pas dériver vers un niveau de détail micro-fonctionnel;
- elle doit être mise à jour uniquement quand le changement est structurel.

## Documents à maintenir

Les documents d'architecture de référence sont:

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [dashboard-next/ARCHITECTURE.md](dashboard-next/ARCHITECTURE.md)
- [src/ARCHITECTURE.md](src/ARCHITECTURE.md)

## Quand mettre à jour la documentation d'architecture

Un agent IA doit mettre à jour un fichier d'architecture quand un changement structurel est introduit, par exemple:

- apparition d'un nouveau grand bloc, dossier ou sous-système;
- redécoupage d'un domaine métier;
- modification d'un flux majeur entre UI, API, services, base ou Discord;
- changement de source de vérité;
- ajout d'une nouvelle couche technique durable;
- déplacement d'une responsabilité importante d'un bloc vers un autre.

Un agent IA ne doit pas mettre à jour ces documents pour:

- un correctif local;
- une petite fonctionnalité qui reste dans la structure existante;
- une variation d'écran ou de formulaire sans impact de structure;
- un détail d'algorithme interne;
- un comportement micro d'une feature déjà documentée.

## Niveau de détail attendu

Le niveau attendu est volontairement haut niveau.

Le document doit expliquer:

- le rôle du bloc;
- ses responsabilités;
- ses interfaces principales;
- ses flux majeurs;
- la manière correcte d'ajouter un nouvel élément dans l'écosystème.

Le document ne doit pas expliquer:

- chaque fonction;
- chaque endpoint unitairement sauf s'il structure un domaine entier;
- chaque prop de composant;
- chaque branche métier ou cas limite;
- le fonctionnement micro de chaque fonctionnalité ajoutée.

Règle pratique:

- si une information aide à choisir où brancher un nouveau développement, elle a probablement sa place;
- si elle n'aide qu'à reproduire ligne par ligne l'implémentation, elle n'a probablement pas sa place.

## Règles de rédaction

- écrire de manière concise et structurée;
- privilégier les responsabilités et les flux;
- nommer les dossiers et fichiers d'entrée réellement utilisés;
- décrire les conventions d'intégration, pas le détail exhaustif;
- éviter les listes d'inventaire trop longues;
- maintenir la cohérence entre les documents racine et les documents de sous-bloc.

## Politique de refactorisation

Si un agent IA constate qu'un fichier qu'il modifie:

- dépasse 500 lignes;
- ou ne respecte plus clairement les principes SOLID;
- ou présente une duplication significative contraire à DRY;

alors il doit considérer qu'un refactoring est à engager.

Comportement attendu:

1. évaluer si le refactoring peut être fait dans la même intervention sans risque disproportionné;
2. si oui, découper la responsabilité et mettre à jour l'architecture si le découpage est structurel;
3. sinon, signaler explicitement dans la réponse finale qu'un refactoring est nécessaire et pourquoi.

Le seuil de 500 lignes n'est pas un dogme absolu, mais un signal fort de risque structurel. Un fichier plus court peut déjà nécessiter un refactoring s'il concentre trop de responsabilités.

## Politique de cohérence documentaire

Quand une architecture change:

- mettre à jour le document le plus local concerné;
- mettre à jour le document racine si la communication entre grands blocs change;
- ne pas dupliquer inutilement la même explication dans plusieurs fichiers;
- préférer des renvois entre documents quand un détail appartient à un autre niveau.

## Processus recommandé pour un agent IA

1. Identifier si le changement est local ou structurel.
2. Modifier le code.
3. Vérifier si l'architecture de `src`, `dashboard-next` ou la communication globale a changé.
4. Mettre à jour uniquement les documents concernés.
5. Garder la documentation à haut niveau.
6. Vérifier si le changement révèle un besoin de refactoring lié à SOLID, DRY ou à la taille des fichiers.

## Critère de qualité

Une bonne mise à jour d'architecture permet à un futur agent IA ou développeur de répondre rapidement à ces questions:

- dans quel bloc ajouter la nouvelle capacité;
- par quelle couche faire passer la logique;
- comment ce bloc communique avec le reste du système;
- quel document consulter ensuite pour aller un niveau plus bas.
