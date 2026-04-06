# 🐳 Guide Docker - Poulet Bot

Ce guide explique comment déployer le bot de modération Poulet et son dashboard avec Docker.

## 📋 Prérequis

- [Docker](https://docs.docker.com/get-docker/) (v24+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2+)
- Un [token Discord](https://discord.com/developers/applications) de bot
- Une clé API [OpenRouter](https://openrouter.ai/) pour l'IA

## 🚀 Démarrage Rapide

### 1. Cloner le projet

```bash
git clone https://github.com/votre-repo/poulet.git
cd poulet
```

### 2. Configurer les variables d'environnement

```bash
# Copier le fichier d'exemple
cp config.env.example config.env

# Editer avec vos valeurs
nano config.env
```

**Variables obligatoires :**
- `TOKEN` - Token Discord de votre bot
- `DISCORD_CLIENT_ID` - ID de l'application Discord
- `DISCORD_CLIENT_SECRET` - Secret de l'application Discord
- `OPENROUTER_API_KEY` - Clé API OpenRouter pour l'IA
- `DASHBOARD_SESSION_SECRET` - Secret aléatoire pour les sessions
- `DASHBOARD_INTERNAL_API_SECRET` - Secret aléatoire pour l'API interne

### 3. Lancer avec Docker Compose

```bash
# Construction et lancement
docker compose up -d --build

# Vérifier les logs
docker compose logs -f

# Vérifier l'état des services
docker compose ps
```

### 4. Accéder au dashboard

Ouvrez votre navigateur : http://localhost:3000

## 📦 Services

| Service | Description | Port |
|---------|-------------|------|
| `sentibot` | Bot Discord avec IA de modération | - |
| `dashboard` | Interface web de modération | 3000 |

## 💾 Volumes Persistants

Les données sont conservées dans des volumes Docker nommés :

| Volume | Contenu |
|--------|---------|
| `sentibot-database` | Base de données SQLite |
| `sentibot-cache` | Cache de l'IA (LangChain) |
| `sentibot-attachments` | Pièces jointes des messages |

## 🔧 Commandes Utiles

```bash
# Voir les logs en temps réel
docker compose logs -f

# Voir les logs d'un service spécifique
docker compose logs -f sentibot
docker compose logs -f dashboard

# Redémarrer un service
docker compose restart sentibot

# Arrêter tous les services
docker compose down

# Reconstruire et redémarrer
docker compose up -d --build

# Supprimer les volumes (ATTENTION: efface les données)
docker compose down -v

# Exécuter une commande dans un conteneur
docker compose exec sentibot sh
docker compose exec dashboard sh

# Voir l'utilisation des ressources
docker compose stats
```

## 🔍 Dépannage

### Le bot ne se connecte pas à Discord

1. Vérifiez que le `TOKEN` est correct dans `config.env`
2. Vérifiez les intents activés dans le [Discord Developer Portal](https://discord.com/developers/applications)
3. Consultez les logs : `docker compose logs sentibot`

### Erreur de base de données

```bash
# Redémarrer le service dashboard en premier
docker compose restart dashboard

# Vérifier les permissions
docker compose exec dashboard ls -la /app/database
```

### Problème de cache IA

```bash
# Vider le cache
docker compose down
docker volume rm sentibot-cache
docker compose up -d
```

### Mettre à jour le bot

```bash
# Récupérer les dernières modifications
git pull

# Reconstruire et redémarrer
docker compose up -d --build
```

## 🌐 Configuration en Production

### Utiliser un reverse proxy (Nginx)

```nginx
server {
    listen 443 ssl;
    server_name votre-domaine.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Variables d'environnement recommandées

```env
DISCORD_REDIRECT_URI=https://votre-domaine.com/api/auth/callback
API_URL=https://votre-domaine.com/api
```

## 📝 Notes

- Le bot nécessite les intents **MESSAGE CONTENT**, **GUILD_MESSAGES**, et **GUILD_MEMBERS**
- La base de données est partagée entre le bot et le dashboard via un volume Docker
- Le cache IA peut prendre plusieurs centaines de Mo selon l'utilisation
- Les sessions d'authentification expirent après 7 jours par défaut

## 🆘 Support

Pour toute question ou problème :
- Ouvrez une issue sur GitHub
- Consultez les logs avec `docker compose logs -f`
- Vérifiez la documentation [Discord.js](https://discord.js.org/)
