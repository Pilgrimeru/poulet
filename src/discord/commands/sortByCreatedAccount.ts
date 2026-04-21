import { Command } from "@/discord/types";
import {
  AttachmentBuilder,
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";

export default class SortByCreatedAccountCommand extends Command {
  constructor() {
    super({
      name: "sortbycreatedaccount",
      description: "liste les membres par date de creation de compte",
      defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
      options: [
        {
          name: "limite",
          description: "nombre max de membres a afficher",
          required: false,
          type: ApplicationCommandOptionType.Integer,
          min_value: 1,
        },
      ],
    });
  }

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      if (!interaction.guild) {
        await interaction.reply({
          content: "Cette commande doit etre utilisee dans un serveur.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const requestedLimit = interaction.options.getInteger("limite", false);
      await interaction.deferReply();

      const allMembers = await interaction.guild.members.fetch();

      const allSortedMembers = Array.from(allMembers.values()).sort(
        (a, b) => b.user.createdTimestamp - a.user.createdTimestamp,
      );

      const effectiveLimit = requestedLimit ?? allSortedMembers.length;
      const sortedMembers = allSortedMembers.slice(0, effectiveLimit);

      if (sortedMembers.length === 0) {
        await interaction.editReply(
          "Aucun membre avec une date de creation de compte trouve.",
        );
        return;
      }

      const lines = sortedMembers.map((member, index) => {
        const createdUnix = Math.floor(member.user.createdTimestamp / 1000);
        return `${index + 1}. <@${member.id}> - <t:${createdUnix}:f>`;
      });

      const header = `Comptes tries du plus recent au plus ancien (${sortedMembers.length}/${allMembers.size}) :`;

      if (lines.length > 300) {
        const fileContent = [header, ...lines].join("\n");
        const attachment = new AttachmentBuilder(
          Buffer.from(fileContent, "utf-8"),
          { name: "sortbycreatedaccount.txt" },
        );

        await interaction.editReply({
          content:
            "La liste est trop longue pour etre envoyee en messages. Je joins un fichier texte.",
          files: [attachment],
        });
        return;
      }

      const chunks: string[] = [];
      let currentChunk = header;

      for (const line of lines) {
        const nextLine = `${currentChunk}\n${line}`;
        if (nextLine.length > 2000) {
          chunks.push(currentChunk);
          currentChunk = line;
        } else {
          currentChunk = nextLine;
        }
      }
      chunks.push(currentChunk);

      await interaction.editReply(chunks[0]);
      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp(chunks[i]);
      }
    } catch (error) {
      console.error("[sortbycreatedaccount] command failed", error);
      if (interaction.deferred || interaction.replied) {
        await interaction
          .editReply("Impossible de trier les membres pour le moment.")
          .catch(console.error);
      } else {
        await interaction
          .reply({
            content: "Impossible de trier les membres pour le moment.",
            flags: MessageFlags.Ephemeral,
          })
          .catch(console.error);
      }
    }
  }
}
