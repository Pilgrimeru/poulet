import { i18n } from "@/app";
import { bot } from "@/app/runtime";
import { Command } from "@/discord/types";
import { CommandInteraction, MessageFlags } from "discord.js";

export default class UptimeCommand extends Command {
  constructor() {
    super({
      name: "uptime",
      description: i18n.__("uptime.description"),
    });
  }

  async execute(interaction: CommandInteraction) {
    let seconds = Math.floor(bot.uptime! / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);

    seconds %= 60;
    minutes %= 60;
    hours %= 24;

    return interaction
      .reply({
        content: i18n.__mf("uptime.result", {
          days: days,
          hours: hours,
          minutes: minutes,
          seconds: seconds,
        }),
        flags: MessageFlags.Ephemeral,
      })
      .catch(console.error);
  }
}
