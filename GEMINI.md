# GEMINI.md - Poulet Bot Context

This file provides architectural context and development guidelines for the `poulet-bot` project, a moderation and utility bot for the "Débat Public" Discord community.

## Project Overview

`poulet-bot` is a TypeScript-based project managed with **Bun**. It consists of three main components:
1.  **Discord Bot**: Built with `discord.js` v14, featuring auto-discovery for commands and events.
2.  **Dashboard API**: A Bun-powered Express server providing data to the dashboard.
3.  **Dashboard UI**: A React application built with Vite for managing bot settings and viewing stats.

### Core Technologies
- **Runtime**: Bun (>= 1.3.10)
- **Language**: TypeScript
- **Database**: SQLite with Sequelize ORM
- **Discord Library**: `discord.js` v14
- **Image Generation**: Satori + Resvg (for stats/tables)
- **Frontend**: React + Vite

## Building and Running

### Prerequisites
- [Bun](https://bun.sh/) installed.
- Discord Bot Token with "Message Content Intent" enabled.

### Commands
- `bun install`: Install dependencies for the root project.
- `bun start` / `bun run prod`: Start the Discord bot.
- `bun run dashboard`: Starts both the Dashboard API and UI in development mode.
- `bun run typecheck`: Runs TypeScript type checking (recommended before every commit).
- `bun run build`: Compiles TypeScript to the `dist/` directory.

### Environment Configuration
The bot uses a `config.env` file (not `.env`).
Required variables:
- `TOKEN`: Your Discord bot token.

Optional variables:
- `LOCALE`: `en` or `fr` (default: `fr`).
- `MAIN_COLOR`: Hex color for embeds.
- `AUTO_DELETE`: Enable/disable auto-deletion of utility messages.

## Architecture & Development Conventions

### Bot Structure
- **Auto-Discovery**: Commands in `src/discord/commands/` and Events in `src/discord/events/` are automatically loaded at startup.
    - **Commands**: Extend `Command` from `src/discord/types/Command.ts` and export as default.
    - **Events**: Export a `new Event("name", handler)` as default.
- **Path Aliases**: Use `@/*` to refer to `src/*`.

### Database & Persistence
- **SQLite**: Data is stored in `database/database.sqlite`.
- **Migrations**: Models sync with `{ force: false }`. To add new columns to existing tables, use the `ensureColumns()` pattern in the respective service class (see `guildSettingsService.ts` for an example).
- **Services**: Each model has a corresponding service in `src/services/` (or `dashboard-api/src/services/`) to handle business logic and DTO transformations.

### Settings UI
- The `/settings` command uses ephemeral messages with scoped component IDs (`src/discord/commands/settings/ids.ts`) to prevent cross-user interaction.
- Interactions are routed through `ComponentRouter` (`src/discord/interactions/ComponentRouter.ts`).

### Internationalization (i18n)
- Localized strings are stored in `src/app/locales/`.
- Use the `i18n` instance from `@/app` for translations.

## Development Workflow
- **Reproduction First**: Before fixing a bug, attempt to reproduce it or write a failing test case (though the project currently has minimal test coverage).
- **Type Safety**: Avoid using `any`. Ensure all new features are properly typed.
- **Atomic Changes**: Keep changes focused on the specific task. Do not perform unrelated refactoring unless requested.
