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

### Entry point & initialization
`src/index.ts` → `src/app/runtime.ts` → instantiates `Bot` (extends `discord.js Client`).
`Bot` auto-discovers and loads all files from `src/discord/commands/` and `src/discord/events/` at startup. Adding a new file in either directory is sufficient — no registration needed.

### Path alias
`@/*` maps to `src/*` throughout the codebase.

### Database
SQLite via Sequelize ORM. File at `database/database.sqlite`. Models sync with `{ force: false }` on startup — **new columns on existing tables must be added via `ensureColumns()` in the service** (see `guildSettingsService.ts` or `messageHistoryService.ts` for the pattern). New tables are created automatically by sync.

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

### Database service pattern
Each model has a service class. Services handle JSON serialization (arrays stored as TEXT), expose DTOs, and call `ensureColumns()` lazily for schema migrations. Services are exported from `src/database/services/index.ts`.

### Environment
Config is loaded from `config.env` (not `.env`). Required: `TOKEN`. Optional: `AUTO_DELETE`, `LOCALE` (en|fr), `MAIN_COLOR` (hex).
