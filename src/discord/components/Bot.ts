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

export class Bot extends Client {
  public commands = new Collection<string, Command>();

  public constructor() {
    super({
      allowedMentions: { repliedUser: false },
      rest: {
        timeout: 30000,
        retries: 6,
      },
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });
    void this.syncDatabase();
    void this.login(config.TOKEN);
    this.on("warn", (info) => console.log("client warn : ", info));
    this.on("error", (e) => console.error("client : ", e));
    void this.loadEvents();
    void this.importCommands();
  }

  private async importCommands(): Promise<void> {
    const slashCommands: ApplicationCommandDataResolvable[] = [];
    const commandsDir = join(__dirname, "..", "commands");
    const commandFiles = readdirSync(commandsDir).filter((file) => {
      if (file.endsWith(".map")) return false;
      const filePath = join(commandsDir, file);
      return statSync(filePath).isFile();
    });

    for (const file of commandFiles) {
      const CommandClass = (
        await import(join(__dirname, "..", "commands", file))
      ).default;
      const commandInstance = new CommandClass() as Command;
      this.commands.set(commandInstance.name, commandInstance);
      slashCommands.push(commandInstance.toCommandDataResolvable());
    }

    this.once("ready", () => {
      this.application?.commands.set(slashCommands);
    });
  }

  private async loadEvents(): Promise<void> {
    const eventsDir = join(__dirname, "..", "events");
    const eventFiles = readdirSync(eventsDir).filter((file) => {
      if (file.endsWith(".map")) return false;
      const filePath = join(eventsDir, file);
      return statSync(filePath).isFile();
    });
    for (const file of eventFiles) {
      const event = (await import(join(__dirname, "..", "events", `${file}`)))
        .default as Event<keyof ClientEvents>;
      this.on(event.name, event.execute);
    }
  }

  private async syncDatabase() {
    try {
      await sequelize.authenticate();
      await sequelize.sync({ force: false });
    } catch (error) {
      console.error("Unable to create tables:", error);
    }
  }

  async startSessionsForGuildMembers() {
    this.guilds.cache.forEach((guild) => {
      guild.channels.cache.forEach((channel) => {
        if (channel.isVoiceBased()) {
          channel.members.forEach((member) => {
            voiceSessionManager.startSession(member.id, channel.id, guild.id);
            if (member.voice.deaf) {
              deafSessionManager.startSession(member.id, channel.id, guild.id);
            }
          });
        }
      });
    });
    console.log("All sessions initialized !");
  }

  async startPollExpiration() {
    (await pollService.getAllActivePolls()).forEach((poll) => {
      pollManager.activateExpiration(poll);
    });
    console.log("All poll initialized !");
  }
}
