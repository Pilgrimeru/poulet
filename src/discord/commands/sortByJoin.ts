import { Command } from "@/discord/types";
import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";

export default class SortByJoinCommand extends Command {
  constructor() {
    super({
      name: "sortbyjoin",
      description: "liste les membres du plus récent au plus ancien",
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

    const allSortedMembers = Array.from(allMembers.values())
      .filter((member) => member.joinedTimestamp !== null)
      .sort((a, b) => (b.joinedTimestamp ?? 0) - (a.joinedTimestamp ?? 0));

    const effectiveLimit = requestedLimit ?? allSortedMembers.length;
    const sortedMembers = allSortedMembers.slice(0, effectiveLimit);

    if (sortedMembers.length === 0) {
      await interaction.editReply(
        "Aucun membre avec une date d'arrivee trouve.",
      );
      return;
    }

    const lines = sortedMembers.map((member, index) => {
      const joinedUnix = Math.floor(
        (member.joinedTimestamp ?? Date.now()) / 1000,
      );
      return `${index + 1}. <@${member.id}> - <t:${joinedUnix}:f>`;
    });

    const header = `Membres triés du plus recent au plus ancien (${sortedMembers.length}/${allMembers.size}) :`;
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
  }
}
