import { config } from "@/app";
import { sequelize } from "@/database";
import { pollService } from "@/database/services";
import {
  deafSessionManager,
  pollManager,
  voiceSessionManager,
} from "@/discord/components";
import { Command, Event } from "@/discord/types";
import {
  ApplicationCommandDataResolvable,
  Client,
  ClientEvents,
  Collection,
  GatewayIntentBits,
} from "discord.js";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DISCORD_DIR = join(__dirname, "..", "..");

export class Bot extends Client {
  public commands = new Collection<string, Command>();

  public constructor() {
    super({
      allowedMentions: { repliedUser: false },
      rest: { timeout: 30000, retries: 6 },
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });

    this.on("warn", (info) => console.warn("[bot]", info));
    this.on("error", (error) => console.error("[bot]", error));

    void this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.syncDatabase();
    await Promise.all([this.loadEvents(), this.loadCommands()]);
    await this.login(config.TOKEN);
  }

  private async loadCommands(): Promise<void> {
    const commandFiles = this.listFiles(join(DISCORD_DIR, "commands"));
    const slashCommands: ApplicationCommandDataResolvable[] = [];

    for (const file of commandFiles) {
      const CommandClass = (await import(join(DISCORD_DIR, "commands", file))).default;
      const instance = new CommandClass() as Command;
      this.commands.set(instance.name, instance);
      slashCommands.push(instance.toCommandDataResolvable());
    }

    this.once("clientReady", () => {
      this.application?.commands.set(slashCommands);
    });
  }

  private async loadEvents(): Promise<void> {
    const eventFiles = this.listFiles(join(DISCORD_DIR, "events"));

    for (const file of eventFiles) {
      const event = (await import(join(DISCORD_DIR, "events", file)))
        .default as Event<keyof ClientEvents>;
      this.on(event.name, event.execute);
    }
  }

  private listFiles(dir: string): string[] {
    return readdirSync(dir).filter((file) => {
      if (file.endsWith(".map")) return false;
      return statSync(join(dir, file)).isFile();
    });
  }

  private async syncDatabase(): Promise<void> {
    try {
      await sequelize.authenticate();
      await sequelize.sync({ force: false });
    } catch (error) {
      console.error("[bot] Unable to sync database:", error);
    }
  }

  async startSessionsForGuildMembers(): Promise<void> {
    for (const guild of this.guilds.cache.values()) {
      for (const channel of guild.channels.cache.values()) {
        if (!channel.isVoiceBased()) continue;
        for (const member of channel.members.values()) {
          voiceSessionManager.startSession(member.id, channel.id, guild.id);
          if (member.voice.deaf) {
            deafSessionManager.startSession(member.id, channel.id, guild.id);
          }
        }
      }
    }
    console.log("[bot] All sessions initialized.");
  }

  async startPollExpiration(): Promise<void> {
    const polls = await pollService.getAllActivePolls();
    polls.forEach((poll) => pollManager.activateExpiration(poll));
    console.log(`[bot] ${polls.length} poll(s) expiration activated.`);
  }
}
