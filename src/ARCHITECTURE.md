# Architecture `src`

## Objectif

`src` contient le runtime principal du projet: le bot Discord, les services métier partagés, les intégrations IA et la configuration applicative. C'est le bloc qui produit les données exploitées ensuite par le dashboard.

Ce runtime est orienté événements. Il écoute Discord, applique les règles métier, persiste l'état utile, déclenche les traitements automatiques et expose une couche d'API interne consommée par d'autres blocs.

## Vue d'ensemble

Le cycle principal est le suivant:

1. `src/index.ts` charge `app/runtime.ts`.
2. `app/runtime.ts` instancie le bot et gère le cycle de vie du process.
3. `discord/components/bot/Bot.ts` initialise Discord, la base, les événements et les commandes.
4. Les événements Discord dans `discord/events/*` déclenchent les traitements métier.
5. Les services de `api/*` lisent et écrivent les données via Sequelize.
6. Les modules `ai/*` enrichissent certains flux de modération.
7. Le dashboard réutilise ensuite les données persistées dans la base partagée.

## Grands blocs

### `app/`

Infrastructure de configuration et bootstrap applicatif.

- `runtime.ts`: démarre le bot, gère l'arrêt propre et la sauvegarde des sessions.
- `config.ts`: lecture de la configuration.
- `i18n.config.ts` et `locales/*`: internationalisation.

Ce dossier est le point d'entrée de l'application, pas l'endroit où ajouter de la logique métier riche.

### `discord/`

Bloc principal orienté événements.

Sous-parties majeures:

- `components/bot`: classe `Bot`, chargement dynamique des commandes et événements;
- `events/*`: réactions au flux Discord;
- `commands/*`: commandes slash et commandes liées aux paramètres, stats, report, etc.;
- `interactions/*`: handlers de composants et interactions complémentaires;
- `components/*`: services métier liés au monde Discord, organisés par domaine (`moderation`, `stats`, `polls`, `spam`);
- `utils/*`: utilitaires de formatage, mapping et helpers de support;
- `types/*`: contrats du runtime Discord.

Le coeur fonctionnel du bot vit ici.

### `api/`

Couche de services métier et de persistance partagée.

Malgré son nom, ce dossier n'est pas une API HTTP publique. Il sert de façade applicative vers la base et centralise les opérations métier persistantes:

- settings;
- snapshots et historique des messages;
- sanctions, appels, reports, messages signalés;
- règles de salon, auto-réponses, filtres anti-spam;
- sessions vocales;
- sondages;
- métadonnées guildes/salons/utilisateurs.

Cette couche est utilisée par:

- les événements et commandes Discord;
- certains modules IA;
- le dashboard, qui reproduit une partie équivalente côté `dashboard-next`.

### `database/`

Infrastructure de base de données du runtime.

- `db.ts`: connexion SQLite;
- `models/*`: modèles Sequelize.

Le runtime `src` est le producteur principal des enregistrements temps réel. Les snapshots de messages, sessions vocales et autres événements y sont alimentés au fil des événements Discord.

### `ai/`

Sous-système d'analyse IA, centré surtout sur la modération.

Sous-parties:

- `core/*`: client LLM, runtime, cache;
- `moderation/*`: prompts, schémas, types, calcul de sanctions, contexte de report;
- `tools/*`: outils appelables par le runtime IA.

L'IA n'est pas autonome sur tout le système. Elle intervient comme composant de décision assistée dans des flux bien ciblés, notamment:

- analyse de messages signalés;
- synthèse de reports;
- suggestion ou escalade de sanction.

### `image-generator/`

Bloc spécialisé pour la génération d'images/tabulations, utilisé notamment par les fonctionnalités de statistiques et de reporting visuel.

### `services/`

Services transverses qui ne relèvent pas directement d'un domaine UI ou Discord. `inviteTrackerService.ts` en est un exemple.

## Comment les blocs s'articulent

### Bootstrap

- `src/index.ts` charge le runtime.
- `app/runtime.ts` crée `bot`.
- `discord/components/bot/Bot.ts`:
  - authentifie la base SQLite;
  - synchronise le schéma;
  - charge dynamiquement commandes et événements;
  - ouvre la session Discord.

### Flux événementiel

Les événements Discord sont la colonne vertébrale du runtime.

Exemple avec `messageCreate.ts`:

- lecture des settings du serveur;
- résolution des règles anti-spam;
- application des règles de salon;
- persistance dans `messageHistoryService` et `messageSnapshotService`;
- lancement d'auto-réponses ou traitements complémentaires.

Ce schéma se répète sur d'autres événements:

- mises à jour de guildes et salons pour maintenir les métadonnées;
- invites pour le suivi des arrivées;
- voice state pour les sessions vocales;
- interactions pour les sondages et flux utilisateur.

### Persistance

Le runtime écrit l'état utile dans SQLite pour rendre le système observable et administrable après coup.

Données majeures produites par `src`:

- historique et snapshots de messages;
- métadonnées de guildes, salons et utilisateurs;
- sessions vocales et agrégats de stats;
- sanctions, appels, reports, flagged messages;
- règles de modération;
- sondages et participations.

### IA

Les événements ou services métier construisent le contexte, puis appellent `ai/*`.

Le sous-système IA:

- consomme des données persistées ou du contexte runtime;
- applique des schémas forts de sortie;
- renvoie une recommandation structurée, pas seulement du texte libre.

La décision finale reste intégrée au pipeline métier existant.

## Points d'intégration privilégiés

### Ajouter une nouvelle réaction à un événement Discord

1. Identifier l'événement concerné dans `discord/events/*`.
2. Déporter la logique métier non triviale vers `discord/components/<domaine>` ou `api/*`.
3. Persister les données utiles si le dashboard ou un traitement différé en dépend.
4. Réutiliser les services existants avant d'en créer de nouveaux.

### Ajouter une nouvelle commande

1. Créer le fichier dans `discord/commands/*`.
2. S'appuyer sur les services de `api/*` pour la logique métier.
3. Éviter de mettre la persistance ou les appels IA directement dans la commande si cela peut être partagé.

### Ajouter une nouvelle donnée métier persistée

1. Étendre le modèle Sequelize.
2. Ajouter le service correspondant dans `api/*`.
3. Brancher la production de cette donnée depuis les événements/commandes concernés.
4. Prévoir l'exposition future au dashboard si la donnée doit être administrable.

### Ajouter une nouvelle brique IA

1. Définir un cas d'usage précis et borné.
2. Ajouter types, schémas et prompts dans `ai/*`.
3. Encapsuler l'appel dans une fonction métier claire.
4. Garder la sortie structurée et exploitable par le reste du système.

## Relations avec `dashboard-next`

`src` est la source de production métier. `dashboard-next` est la surface d'observation et d'édition.

Relation principale:

- `src` alimente la base;
- `dashboard-next` lit cette base et complète avec l'état courant de Discord;
- certains modèles et services existent en miroir des deux côtés pour travailler sur le même schéma de données.

Ce couplage impose une discipline:

- les changements structurels de schéma ou de flux doivent être pensés pour les deux runtimes;
- les nouveaux concepts métier doivent être documentés à haut niveau dans les fichiers d'architecture.

## Règles d'évolution

- préférer une logique métier encapsulée dans `api/*` ou `discord/components/*` plutôt que dispersée dans les handlers d'événements;
- garder les événements et commandes comme points d'entrée, pas comme zones d'accumulation;
- réserver `ai/*` aux traitements réellement assistés par modèle;
- documenter les nouveaux blocs structurels, pas les détails micro d'implémentation.

Pour la vue système globale, voir [../ARCHITECTURE.md](../ARCHITECTURE.md).
