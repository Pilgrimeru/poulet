import { CommandInteraction } from "discord.js";
import { i18n } from "@/app";
import { Command } from "@/discord/types";
import { autoDelete } from "@/discord/utils";

export default class PingCommand extends Command {
  constructor() {
    super({
      name: "ping",
      description: i18n.__("ping.description"),
    });
  }

  async execute(interaction: CommandInteraction) {
    interaction
      .reply(
        i18n.__mf("ping.result", {
          ping: Math.round(interaction.guild!.client.ws.ping),
        }),
      )
      .then(autoDelete);
  }
}
