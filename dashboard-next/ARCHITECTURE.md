# Architecture `dashboard-next`

## Objectif

`dashboard-next` est l'interface d'administration du bot. Ce bloc expose une application Next.js qui:

- authentifie les opérateurs via Discord OAuth;
- lit et modifie les données métier stockées en base SQLite;
- enrichit certaines données avec l'état courant de Discord;
- organise l'UI par domaines fonctionnels (`history`, `stats`, `settings`, `moderation`).

Le dashboard n'est pas le coeur métier temps réel. Il agit comme une couche d'accès, d'orchestration et d'édition au-dessus du runtime principal situé dans `src`.

## Vue d'ensemble

Le flux standard est le suivant:

1. Une page App Router dans `app/*` compose une vue métier.
2. La vue s'appuie sur des hooks ou sur un module `features/*`.
3. Les appels réseau partent vers les routes internes `app/api/*`.
4. Les routes API appellent les services de `services/*`.
5. Les services lisent soit:
   - les modèles Sequelize dans `models/*` via `lib/db.ts`,
   - les métadonnées Discord via `services/discordMetaService.ts`.
6. La réponse remonte à l'UI avec des DTO adaptés aux composants.

## Grands blocs

### `app/`

Point d'entrée de l'application Next.js.

- `layout.tsx` pose le shell global et injecte la `Navbar`.
- `page.tsx` sert de landing page.
- `history`, `stats`, `settings`, `moderation`, `login` sont les entrées de navigation principales.
- `app/api/*` contient les endpoints internes consommés par le front.

Convention d'intégration:

- ajouter une nouvelle capacité utilisateur d'abord comme nouvelle route/page ou comme section d'une feature existante;
- éviter de mettre de la logique métier lourde directement dans `page.tsx`;
- réserver les pages à la composition d'écran, à la navigation et à l'état d'orchestration.

### `features/`

Couche métier front par domaine.

- `features/settings`: appels API, hooks et types du panneau de configuration.
- `features/stats`: orchestration des agrégats et adaptation aux graphiques.
- `features/moderation`: lecture/édition des appels, sanctions, reports et flags.
- `features/navigation`: définition de la navigation transverse.

Cette couche est le bon endroit pour:

- centraliser les types DTO du domaine;
- regrouper les appels réseau front d'un domaine;
- porter l'état d'écran qui dépasse un composant unitaire.

### `components/`

Bibliothèque UI et composants transverses.

- `components/ui`: primitives visuelles réutilisables.
- `Navbar`, `Sidebar`, `FilterBar`, `MessageList`, `HistoryModal`: composants partagés entre plusieurs écrans ou servant de briques d'écran.

Règle de découpage:

- un composant de présentation ne doit pas connaître Sequelize ni Discord;
- il reçoit des props déjà adaptées au besoin de l'interface.

### `hooks/`

Hooks simples, orientés données d'écran.

- `useGuilds`, `useChannels`, `useMessages` encapsulent les chargements de base pour l'historique.

Quand ajouter un hook ici:

- si la logique est transversale à plusieurs écrans;
- si elle reste centrée sur l'état client et le chargement de données.

Sinon, préférer `features/<domaine>`.

### `app/api/`

Façade HTTP interne du dashboard.

Responsabilités:

- vérifier l'authentification si nécessaire;
- lire les paramètres de route et de query;
- transformer le body HTTP en appel de service;
- retourner un contrat JSON simple pour le front.

Les routes doivent rester minces. Dès que plusieurs routes partagent la même logique, cette logique doit vivre dans `services/*`.

### `services/`

Couche serveur principale du dashboard.

On y trouve deux familles:

- services d'accès métier à la base et aux modèles Sequelize;
- services d'intégration Discord (`discordMetaService`) pour hydrater les métadonnées courantes et exécuter certaines actions.

Exemples:

- `guildSettingsService.ts`: persistance et migration légère des réglages;
- `messageSnapshotService.ts`: lecture des snapshots, historique et pièces jointes;
- `statsService.ts`: agrégats métier pour le dashboard;
- `discordMetaService.ts`: lecture des guildes, salons, rôles et membres via l'API Discord.

Convention d'intégration:

- un nouveau domaine serveur commence par un service dédié;
- la route API appelle ce service;
- le front consomme la route via une API locale dans `features/*` ou `lib/*`.

### `models/`

Schéma de données côté dashboard, basé sur Sequelize.

Ces modèles reflètent le stockage partagé avec le runtime principal dans `src`. Le dashboard les lit et les met à jour directement sur la même base SQLite.

Conséquence architecturale:

- le dashboard n'est pas un backend séparé avec sa propre base;
- il partage le contrat de persistance avec le bot.

### `lib/`

Infrastructure transversale.

- `db.ts`: connexion SQLite partagée et singleton dev;
- `auth.ts`: session OAuth Discord et cookies signés;
- `api-client.ts`, `api-stats.ts`, `http.ts`: helpers de communication front;
- `db/init.ts`: initialisation base si nécessaire.

`lib/*` doit rester générique. La logique d'un domaine métier ne doit pas y dériver.

## Intégration avec le reste de l'écosystème

### Base de données partagée

`dashboard-next` et `src` pointent vers la même base SQLite et le même répertoire de pièces jointes. Le dashboard exploite donc directement les données produites par le bot:

- snapshots de messages;
- sanctions, appels, reports;
- règles de modération;
- sessions vocales et statistiques;
- métadonnées guildes, salons, utilisateurs.

### Discord comme source de vérité secondaire

Le dashboard n'est pas purement centré base. Certaines informations sont enrichies à la volée via Discord:

- noms de guildes;
- noms de salons;
- rôles;
- avatars et display names.

La persistance reste la source stable; Discord sert surtout à hydrater l'état courant quand il est disponible.

### Front vs serveur

Le front ne doit jamais parler directement à Discord ni à Sequelize. Il doit passer par:

- les routes `app/api/*`;
- puis les services du dashboard.

Cette séparation simplifie l'ajout de nouvelles capacités sans répandre de la logique d'infrastructure dans les composants React.

## Flux majeurs

### Historique des messages

- UI: `app/history/page.tsx`
- hooks: `useGuilds`, `useChannels`, `useMessages`
- API: `/api/guilds`, `/api/guilds/[guildId]/channels`, `/api/channels/[channelId]/messages`, `/api/messages/[messageId]/history`
- services: `messageSnapshotService`, `discordMetaService`

Le dashboard lit les snapshots persistés, puis hydrate les auteurs et la hiérarchie de salons avec l'état Discord courant.

### Paramètres

- UI: `app/settings/page.tsx`
- domaine: `features/settings/*`
- API: `/api/guilds/[guildId]/settings`, `/spam-rules`, `/channel-rules`, `/auto-responses`, `/discord-roles`, `/all-channels`
- services: `guildSettingsService`, `spamFilterRuleService`, `channelRuleService`, `autoResponseService`, `discordMetaService`

### Modération

- UI: `app/moderation/page.tsx`
- domaine: `features/moderation/*`
- API: appels, sanctions, reports, flagged messages
- services: services métier de modération + enrichissement utilisateur

Cette zone assemble plusieurs sous-domaines reliés entre eux par les identifiants de sanction.

### Statistiques

- UI: `app/stats/page.tsx`
- domaine: `features/stats/*`
- API: routes `stats/*`
- services: `statsService`, `memberStatsService`, `sessionService`, `statsReportMessageStateService`

Le dashboard consomme surtout des agrégats déjà structurés côté serveur.

## Comment ajouter un nouvel élément

Pour un nouveau domaine fonctionnel:

1. Définir le besoin métier et choisir s'il s'agit d'un nouveau domaine ou d'une extension d'un domaine existant.
2. Créer ou étendre un service dans `services/*`.
3. Exposer ce service via une route dans `app/api/*`.
4. Ajouter les types et appels front dans `features/<domaine>` ou `lib/*` selon la portée.
5. Brancher l'écran dans `app/*` et la navigation si nécessaire.
6. Réutiliser `components/ui` avant d'introduire de nouvelles primitives.

Pour une nouvelle donnée persistée:

1. Ajouter ou étendre le modèle Sequelize concerné.
2. Mettre à jour le service qui encapsule cette donnée.
3. Exposer les DTO utiles au dashboard.
4. Documenter le changement si la structure du domaine évolue.

## Règles d'évolution

- privilégier une organisation par domaine métier plutôt que par type technique quand une fonctionnalité grossit;
- garder les routes API minces;
- éviter la duplication de logique entre `features/*` et `services/*`;
- ne pas coupler directement les composants React aux détails de persistance;
- faire évoluer ce document quand un nouveau bloc structurel apparaît, qu'un flux majeur change ou qu'un domaine est redécoupé.

Pour la vue système globale, voir [../ARCHITECTURE.md](../ARCHITECTURE.md).
