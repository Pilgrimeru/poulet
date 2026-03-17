### Etape 1 : installer uniquement les dependances de production ###
FROM oven/bun:1.3.10-alpine AS prod-deps

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

### Etape 2 : image finale d'execution ###
FROM oven/bun:1.3.10-alpine

RUN echo @edge http://nl.alpinelinux.org/alpine/edge/community >> /etc/apk/repositories && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/main >> /etc/apk/repositories && \
    apk add --no-cache \
      chromium@edge \
      nss@edge

WORKDIR /app

COPY src ./src
COPY resources ./resources
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json tsconfig.json bun.lock* ./
COPY config.env ./

RUN adduser -D appuser && \
    mkdir -p /app/database /app/cache && \
    chown -R appuser:appuser /app/database && \
    chown -R appuser:appuser /app/cache

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

USER appuser

CMD ["bun", "run", "./src/index.ts"]
