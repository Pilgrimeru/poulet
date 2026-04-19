# Architecture globale

## Objectif

Le projet est organisé autour de deux grands blocs applicatifs qui partagent le même modèle de données métier:

- `src`: runtime principal du bot Discord, orienté événements;
- `dashboard-next`: interface d'administration et d'observation, orientée App Router + API internes.

La base SQLite et le stockage des pièces jointes servent de point de jonction stable entre ces blocs.

## Grands blocs

### `src`

Responsabilités:

- écouter Discord en temps réel;
- appliquer les règles métier;
- produire les données persistées;
- déclencher les automatisations;
- intégrer l'IA sur certains flux de modération.

Documentation détaillée: [src/ARCHITECTURE.md](src/ARCHITECTURE.md)

### `dashboard-next`

Responsabilités:

- authentifier les opérateurs;
- exposer une surface de lecture et d'édition;
- agréger les données utiles pour l'administration;
- enrichir certains écrans avec l'état courant de Discord.

Documentation détaillée: [dashboard-next/ARCHITECTURE.md](dashboard-next/ARCHITECTURE.md)

## Communications entre blocs

### 1. Persistance partagée

Le canal de communication principal n'est pas un appel HTTP entre services séparés. C'est la base SQLite partagée.

`src` écrit:

- snapshots et historique des messages;
- sanctions, appels, flagged messages, moderation reports;
- settings et règles de modération;
- métadonnées guildes, salons, utilisateurs;
- sessions vocales et statistiques;
- sondages et participations.

`dashboard-next` lit et met à jour ces mêmes données via ses propres services Sequelize.

### 2. Discord comme source d'enrichissement

Les deux blocs peuvent interagir avec Discord, mais avec des rôles différents:

- `src` travaille en temps réel via `discord.js`;
- `dashboard-next` fait surtout de la lecture ciblée via REST pour hydrater noms, rôles, avatars et structure courante.

Discord n'est donc pas la seule source de vérité. Le stockage local sert de mémoire durable; Discord sert de source de fraîcheur pour certains champs.

### 3. Front dashboard vers serveur dashboard

À l'intérieur de `dashboard-next`, la communication suit ce chemin:

1. page ou feature React;
2. appel vers `app/api/*`;
3. service serveur `services/*`;
4. lecture/écriture sur base ou appel Discord.

Le front du dashboard ne doit pas court-circuiter ces couches.

### 4. IA dans l'écosystème

L'IA vit côté `src` et s'insère dans les flux métier du bot. Ses sorties structurées sont ensuite visibles indirectement dans le dashboard via les données persistées.

Exemple:

- un report ou un message signalé est analysé dans `src/ai/*`;
- le résultat est stocké via les services métier;
- le dashboard l'affiche et permet aux modérateurs d'agir dessus.

## Découpage de responsabilité

- `src` décide, observe, collecte et produit.
- `dashboard-next` expose, administre, corrige et navigue.
- la base partagée synchronise les deux mondes.

Ce découpage permet d'ajouter un nouveau domaine en le branchant d'abord dans `src` si c'est une capacité temps réel, puis dans `dashboard-next` si cette capacité doit être visible ou administrable.

## Quand mettre à jour cette documentation

Mettre à jour ce fichier lorsque:

- un nouveau grand bloc apparaît;
- la manière dont `src` et `dashboard-next` communiquent change;
- une nouvelle source de vérité est introduite;
- un domaine est déplacé d'un bloc à l'autre.

Pour les conventions de maintenance de cette documentation par un agent IA, voir [AI_AGENT_GUIDE.md](AI_AGENT_GUIDE.md).
