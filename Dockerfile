### Etape 1 : Installer uniquement les dépendances de production ###
FROM oven/bun:1.3.10-alpine AS prod-deps

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

### Etape 2 : Image finale d'exécution ###
FROM oven/bun:1.3.10-alpine

RUN apk add --no-cache tini

WORKDIR /app

# Copier le code source
COPY src ./src
COPY scripts ./scripts
COPY package.json tsconfig.json bun.lock* ./

# Copier les dépendances de production
COPY --from=prod-deps /app/node_modules ./node_modules

# Créer les répertoires nécessaires
RUN adduser -D appuser && \
    mkdir -p /app/database /app/cache /app/resources /app/database/attachments && \
    chown -R appuser:appuser /app

# Variables d'environnement
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/database/database.sqlite
ENV ATTACHMENTS_PATH=/app/database/attachments
ENV AI_LLM_CACHE_PATH=/app/cache/langchain-llm-cache.sqlite

USER appuser

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bun", "run", "./src/index.ts"]
