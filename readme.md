## Prerequisites 📋

Before running the bot, make sure you have the following:

- **Bun:** Version 1.3.10 or higher.
- **Discord API Token:** Optionally, enable "Message Content Intent" in Discord Developer Portal.

## Installation 🛠️

To get started with the bot, follow these steps:

1. Clone this repository to your local machine.
2. Navigate to the bot's directory and run the following command to install dependencies:

   ```bash
   bun install
   ```

3. Rename config.env.example to config.env and fill out the values:
   ```env
   TOKEN = ""
   ```
4. Start the bot with:

   ```bash
   bun run start
   ```

## Production with Bun

Use Bun directly on TypeScript (no JS build required):

```bash
bun run prod
```
