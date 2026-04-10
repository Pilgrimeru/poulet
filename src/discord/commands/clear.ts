import { Command } from "@/discord/types";
import { autoDelete } from "@/discord/utils";
import {
  ApplicationCommandOptionType,
  ChannelType,
  ChatInputCommandInteraction,
  Collection,
  MessageFlags,
  Message,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";

export default class RuleCommand extends Command {
  constructor() {
    super({
      name: "clear",
      description: "supprime le nombre de message indiqué",
      defaultMemberPermissions: PermissionFlagsBits.ManageMessages,
      options: [
        {
          name: "number",
          description: "nombre de message à supprimé",
          required: true,
          type: ApplicationCommandOptionType.Integer,
          min_value: 1,
          max_value: 200,
        },
        {
          name: "user",
          description: "supprime uniquement les messages de cet utilisateur",
          required: false,
          type: ApplicationCommandOptionType.User,
        },
      ],
    });
  }

  async execute(interaction: ChatInputCommandInteraction) {
    const number = interaction.options.getInteger("number", true);
    const targetUser = interaction.options.getUser("user");

    if (interaction.channel?.type === ChannelType.GuildText) {
      const messagesToDelete = await this.getMessagesToDelete(
        interaction.channel,
        number,
        targetUser?.id,
      );
      if (messagesToDelete.size === 0) {
        return interaction.reply("Aucun message nettoyable.").then(autoDelete);
      }

      // Discord limite bulkDelete à 100 messages par appel.
      const chunks = this.chunkCollection(messagesToDelete, 100);
      let deleted = 0;
      for (const chunk of chunks) {
        const result = await interaction.channel.bulkDelete(chunk, true);
        deleted += result.size;
      }

      return interaction.reply({
        content: `Nettoyage terminé. 🧹 (${deleted} message(s) supprimé(s))`,
        flags: MessageFlags.Ephemeral,
      });
    }
    return interaction.reply("Echec du nettoyable.").then(autoDelete);
  }

  private async getMessagesToDelete(
    channel: TextChannel,
    targetCount: number,
    targetUserId?: string,
  ): Promise<Collection<string, Message>> {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const selected = new Collection<string, Message>();
    let before: string | undefined;

    while (selected.size < targetCount) {
      const batch = await channel.messages.fetch({ limit: 100, before });
      if (batch.size === 0) break;

      for (const [, message] of batch) {
        if (message.createdTimestamp < cutoff) continue;
        if (targetUserId && message.author.id !== targetUserId) continue;

        selected.set(message.id, message);
        if (selected.size >= targetCount) break;
      }

      before = batch.last()?.id;
      if (!before) break;
    }

    return selected;
  }

  private chunkCollection(
    messages: Collection<string, Message>,
    size: number,
  ): Collection<string, Message>[] {
    const chunks: Collection<string, Message>[] = [];
    let current = new Collection<string, Message>();

    for (const [id, message] of messages) {
      current.set(id, message);
      if (current.size === size) {
        chunks.push(current);
        current = new Collection<string, Message>();
      }
    }

    if (current.size > 0) chunks.push(current);
    return chunks;
  }
}
