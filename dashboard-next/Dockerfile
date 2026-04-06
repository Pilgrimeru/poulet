### Etape 1 : Dépendances de production (avec compilation native) ###
FROM oven/bun:1.3.10-alpine AS prod-deps

# Outils pour compiler sqlite3 depuis les sources (musl/Alpine, pas de prebuild compatible)
RUN apk add --no-cache python3 make g++ sqlite-dev

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

### Etape 2 : Build de l'application Next.js ###
FROM oven/bun:1.3.10-alpine AS builder

RUN apk add --no-cache python3 make g++ sqlite-dev

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

### Etape 3 : Image de production ###
FROM oven/bun:1.3.10-alpine

RUN apk add --no-cache tini

WORKDIR /app

# Copier le build standalone de Next.js
# outputFileTracingRoot pointe vers le parent (/), donc standalone structure le projet sous app/
COPY --from=builder /app/.next/standalone/app/ ./
COPY --from=builder /app/.next/static ./.next/static

# Remplacer les node_modules du standalone par ceux compilés pour Alpine
# (le standalone ne trace pas les bindings natifs .node de sqlite3)
COPY --from=prod-deps /app/node_modules ./node_modules

# Créer les répertoires nécessaires
RUN adduser -D appuser && \
    mkdir -p /app/database /app/.next/static /app/public && \
    chown -R appuser:appuser /app

USER appuser

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_PATH=/app/database/database.sqlite
ENV ATTACHMENTS_PATH=/app/database/attachments

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bun", "run", "server.js"]
