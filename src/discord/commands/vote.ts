import { fr } from "chrono-node";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { nanoid } from "nanoid";
import { pollManager } from "@/discord/components";
import { config } from "@/app";
import { Command } from "@/discord/types";

export default class VoteCommand extends Command {
  constructor() {
    super({
      name: "vote",
      description: "Crée une session de vote",
      options: [
        {
          name: "titre",
          description: "Le titre du vote",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "expiration",
          description:
            "Durée d'expiration du vote (ex: '1 jour', '5 minutes', '24/08/2024', 'demain')",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "options",
          description: "Options du vote séparées par des pipes '|'",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "multiple",
          description: "Autoriser les votes multiples",
          type: ApplicationCommandOptionType.Boolean,
          required: false,
        },
      ],
    });
  }

  async execute(interaction: ChatInputCommandInteraction) {
    const title = interaction.options.getString("titre", true);
    const expirationString = interaction.options.getString("expiration", true);
    const optionsString = interaction.options.getString("options", true);
    const allowMultipleChoice =
      interaction.options.getBoolean("multiple") ?? false;

    // Traduction des termes français en anglais
    const expirationDate = fr.parseDate(this.interpret(expirationString));
    if (!expirationDate || expirationDate.getTime() < Date.now()) {
      return interaction.reply({
        content:
          "La durée d'expiration est invalide. Veuillez réessayer avec un format valide.",
        ephemeral: true,
      });
    }
    const expiration = Math.floor(expirationDate.getTime());

    const options = optionsString.split("|").map((option) => option.trim());
    if (!options || options.length == 0) {
      return interaction.reply({
        content: "Les options sont requises",
        ephemeral: true,
      });
    }
    const pollId = this.generateVoteSessionID();

    // Crée l'embed de vote
    const embed = new EmbedBuilder()
      .setTitle(`📊 ${title}`)
      .setDescription(`*0 votes*`)
      .addFields(
        options.map((option, index) => ({
          name: `${index + 1}. ${option}`,
          value: "⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛`0% (0)`",
          inline: false,
        })),
      )
      .setColor(config.COLORS.MAIN)
      .setFooter({
        text: `id : ${pollId}`,
      });

    const lastField = embed.data.fields?.at(-1);
    lastField!.value += `\n---\n⏳ Expire <t:${Math.round(expiration / 1000)}:R>\n🔢 Choix multiple: ${allowMultipleChoice ? "`activé`" : "`désactivé`"}`;

    // Crée les boutons de vote
    const buttonsRows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < options.length; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>();
      options.slice(i, i + 5).forEach((_, index) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`v:${pollId}:${i + index}`)
            .setLabel(`${i + index + 1}`)
            .setStyle(ButtonStyle.Primary),
        );
      });
      buttonsRows.push(row);
    }

    await interaction.reply({ embeds: [embed] });
    const message = await interaction.fetchReply();
    const messagePath = `${message.guildId}:${message.channelId}:${message.id}`;

    // Crée la session de vote
    await pollManager.startPoll({
      pollId,
      title,
      messagePath,
      expiration,
      allowMultipleChoice,
      options: JSON.stringify(options),
    });

    await interaction.editReply({ components: buttonsRows });
  }

  // Générateur d'ID de session de vote utilisant nanoid
  generateVoteSessionID(): string {
    return nanoid(10);
  }

  interpret(frenchString: string): string {
    return frenchString
      .replace(/\b(\d+)\s*minutes?\b/i, "dans $1 minutes")
      .replace(/\b(\d+)\s*heures?\b/i, "dans $1 heures")
      .replace(/\b(\d+)\s*jours?\b/i, "dans $1 jours")
      .replace(/\b(\d+)\s*semaines?\b/i, "dans $1 semaines")
      .replace(/\b(\d+)\s*mois\b/i, "dans $1 mois")
      .replace(/\b(\d+)\s*ans?\b/i, "dans $1 ans")
      .replace(/\bun[ea]?\s*minute\b/i, "dans 1 minute")
      .replace(/\bun[ea]?\s*heure\b/i, "dans 1 heure")
      .replace(/\bun[ea]?\s*jour\b/i, "dans 1 jour")
      .replace(/\bun[ea]?\s*semaine\b/i, "dans 1 semaine")
      .replace(/\bun[ea]?\s*mois\b/i, "dans 1 mois")
      .replace(/\bun[ea]?\s*an\b/i, "dans 1 an")
      .replace(/\b(\d+)\s*m\b/i, "dans $1 minutes")
      .replace(/\b(\d+)\s*min\b/i, "dans $1 minutes")
      .replace(/\b(\d+)\s*h\b/i, "dans $1 heures")
      .replace(/\b(\d+)\s*j\b/i, "dans $1 jours")
      .replace(/\b(\d+)\s*s\b/i, "dans $1 semaines")
      .replace(/\b(\d+)\s*mo\b/i, "dans $1 mois")
      .replace(/\b(\d+)\s*a\b/i, "dans $1 ans");
  }
}
