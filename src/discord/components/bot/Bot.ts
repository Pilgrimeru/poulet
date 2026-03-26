import { config } from "@/app";
import { pollService } from "@/api";
import {
  deafSessionManager,
  pollManager,
  voiceSessionManager,
} from "@/discord/components";
import { Command, ContextMenuCommand, Event } from "@/discord/types";
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
  public contextMenuCommands = new Collection<string, ContextMenuCommand>();

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
    await Promise.all([this.loadEvents(), this.loadCommands()]);
    await this.login(config.TOKEN);
  }

  private async loadCommands(): Promise<void> {
    const commandFiles = this.listFiles(join(DISCORD_DIR, "commands"));
    const allCommands: ApplicationCommandDataResolvable[] = [];

    for (const file of commandFiles) {
      const mod = await import(join(DISCORD_DIR, "commands", file));

      if (mod.default) {
        const instance = new mod.default() as Command;
        this.commands.set(instance.name, instance);
        allCommands.push(instance.toCommandDataResolvable());
      }

      const contextMenuClasses = mod.contextMenus ?? (mod.contextMenu ? [mod.contextMenu] : []);
      for (const cls of contextMenuClasses) {
        const instance = new cls() as ContextMenuCommand;
        this.contextMenuCommands.set(instance.name, instance);
        allCommands.push(instance.toCommandDataResolvable());
      }
    }

    this.once("clientReady", () => {
      // Vider les commandes globales (évite les doublons avec les commandes guild)
      this.application?.commands.set([]).catch(() => undefined);

      for (const guild of this.guilds.cache.values()) {
        guild.commands.set(allCommands).then((cmds) => {
          console.log(`[bot] ${cmds.size} commande(s) enregistrée(s) sur ${guild.name} :`, cmds.map((c) => `${c.name} (${c.type})`).join(", "));
        }).catch((err) => console.error(`[bot] Erreur enregistrement commandes sur ${guild.name}:`, err));
      }
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
