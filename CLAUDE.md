# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun start          # Run the bot (development)
bun run typecheck  # TypeScript type checking without emitting
bun run build      # Compile TypeScript to dist/
bun test           # Run tests (currently no tests)
```

No linter is configured. Use `bun run typecheck` to catch type errors before running.

## Architecture

This repo contains two main applications:
- **`src/`** — Discord bot (discord.js)
- **`dashboard-next/`** — Next.js dashboard UI + API (replaces legacy `dashboard/` and `dashboard-api/`)

### Bot entry point & initialization
`src/index.ts` → `src/app/runtime.ts` → instantiates `Bot` (extends `discord.js Client`).
`Bot` auto-discovers and loads all files from `src/discord/commands/` and `src/discord/events/` at startup. Adding a new file in either directory is sufficient — no registration needed.

### Path alias
`@/*` maps to `src/*` throughout the codebase.

### Database
SQLite via Sequelize ORM. File at `database/database.sqlite`. Models sync with `{ force: false }` on startup — **new columns on existing tables must be added via `ensureColumns()` in the service** (see `guildSettingsService.ts` or `messageHistoryService.ts` for the pattern). New tables are created automatically by sync. Sequelize is a singleton to prevent multiple instances during hot reload.

### Environment / config
Bot config is loaded from `config.env` (not `.env`). Dashboard-next falls back to parent `config.env` if its own is missing.

| Variable | Scope | Required |
|---|---|---|
| `TOKEN` | Bot | Yes |
| `AUTO_DELETE` | Bot | No |
| `LOCALE` | Bot | No (en\|fr) |
| `MAIN_COLOR` | Bot | No (hex) |
| `GUILD_ID` | Bot | No |
| `DISCORD_CLIENT_ID` | Dashboard | Yes |
| `DISCORD_CLIENT_SECRET` | Dashboard | Yes |
| `DISCORD_REDIRECT_URI` | Dashboard | Yes |
| `DASHBOARD_SESSION_SECRET` | Dashboard | Yes |
| `DASHBOARD_INTERNAL_API_SECRET` | Dashboard | Yes |
| `API_URL` | Dashboard | Yes |
| `DATABASE_PATH` | Dashboard | Yes |

### Adding a command
Extend `Command` (`src/discord/types/Command.ts`) and export as default class. The file is auto-loaded from `src/discord/commands/`.

### Adding an event
Export a `new Event("eventName", handler)` as default from a file in `src/discord/events/`. Auto-loaded.

### Settings UI pattern
The `/settings` command renders ephemeral Discord UI with select menus. All component interactions are routed through `ComponentRouter` (`src/discord/interactions/ComponentRouter.ts`), which supports exact `customId` match and prefix-based matching.

Handlers are registered in `SettingsCommand.registerHandlers()` with a 10-minute TTL, then unregistered on expiry. **Component IDs are scoped per-user** via `scopeIds(userId)` in `src/discord/commands/settings/ids.ts` — this prevents users from interacting with another user's settings menu. When adding a new settings section:
1. Add scoped ID fields to `ScopedSettingsIds` interface and `scopeIds()` in `ids.ts`
2. Create a `settings/myFeature.ts` file with render + handler functions
3. Register/unregister handlers in `settings/index.ts`
4. Add a menu entry in `settings/home.ts` and a nav branch in `antiSpam.ts:onMainMenuSelection`

Component IDs use colon delimiters for parsed routing (e.g., `v:pollId:optionId`).

### Database service pattern
Each model has a service. Services handle JSON serialization (arrays stored as TEXT), expose DTOs, and call `ensureColumns()` lazily for schema migrations. Services are exported from `src/database/services/index.ts`. Meta services (channel, guild, user) support `bulkUpsert()` for batch operations.

### Caching
`createTimedCache<K,V>()` (in `src/utils/`) provides TTL-based caching with in-flight deduplication — concurrent requests for the same key coalesce into one fetch. Invalidation is manual (e.g., `invalidateSpamCheckers()`).

### Dashboard auth
OAuth2 with HMAC-SHA256 signed JWTs. Session stored in `poulet_dashboard_session` httpOnly cookie. State param has a 10-minute TTL. Cookie `secure` flag is only set in production (`NODE_ENV=production`).

### Stats services (dashboard-next)
`dashboard-next/services/statsService.ts` aggregates message and voice stats from SQLite. Voice durations are clamped to requested date ranges and converted to seconds. User metadata is hydrated via `getUserMetas()` which reads the latest snapshot from `MessageSnapshot`.

### Graceful shutdown
The bot saves active sessions on `SIGINT`/`SIGUSR1`/`SIGUSR2`.

### i18n
Multilingual support (en/fr) via `i18n`. Locale is set by `LOCALE` env var.
