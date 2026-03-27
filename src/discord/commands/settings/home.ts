import { config } from "@/app";
import { ScopedSettingsIds } from "@/discord/commands/settings/ids";
import { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder } from "discord.js";

export async function renderHome(ids: ScopedSettingsIds) {
  const embed = new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle("Settings")
    .setDescription("Choisis la section a configurer.");

  const menu = new StringSelectMenuBuilder()
    .setCustomId(ids.MENU)
    .setPlaceholder("Sections")
    .addOptions([
      { label: "Anti Spam", description: "Creer et modifier plusieurs filtres", value: "anti_spam" },
      { label: "Stats", description: "Configurer exclusions et vocal casque coupe", value: "stats" },
      { label: "Regles par salon", description: "Reactions, threads auto, limite de messages", value: "channel_rules" },
      { label: "Invite Log", description: "Salon de log des arrivees et departs", value: "invite_log" },
    ]);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
  };
}
