import { Command } from "@/discord/types";
import { autoDelete } from "@/discord/utils";
import {
  ApplicationCommandOptionType,
  ChannelType,
  ChatInputCommandInteraction,
  Collection,
  Message,
  MessageFlags,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";

export default class SuperClearCommand extends Command {
  constructor() {
    super({
      name: "superclear",
      description: "supprime tous les messages entre deux IDs inclus",
      defaultMemberPermissions: PermissionFlagsBits.ManageMessages,
      options: [
        {
          name: "oldest_id",
          description: "ID du message le plus ancien",
          required: true,
          type: ApplicationCommandOptionType.String,
        },
        {
          name: "newest_id",
          description: "ID du message le plus recent",
          required: true,
          type: ApplicationCommandOptionType.String,
        },
      ],
    });
  }

  async execute(interaction: ChatInputCommandInteraction) {
    const oldestId = interaction.options.getString("oldest_id", true).trim();
    const newestId = interaction.options.getString("newest_id", true).trim();

    if (interaction.channel?.type !== ChannelType.GuildText) {
      return interaction.reply("Echec du nettoyable.").then(autoDelete);
    }

    const oldestMessage = await interaction.channel.messages
      .fetch(oldestId)
      .catch(() => null);
    const newestMessage = await interaction.channel.messages
      .fetch(newestId)
      .catch(() => null);

    if (!oldestMessage || !newestMessage) {
      return interaction.reply("Impossible de trouver ces messages.").then(autoDelete);
    }

    const messagesToDelete = await this.getMessagesInRange(
      interaction.channel,
      oldestMessage,
      newestMessage,
    );

    if (messagesToDelete.size === 0) {
      return interaction.reply("Aucun message nettoyable.").then(autoDelete);
    }

    const chunks = this.chunkCollection(messagesToDelete, 100);
    let deleted = 0;

    for (const chunk of chunks) {
      const result = await interaction.channel.bulkDelete(chunk, true);
      deleted += result.size;
    }

    if (deleted === 0) {
      return interaction.reply("Aucun message supprimable (plus de 14 jours).").then(autoDelete);
    }

    return interaction.reply({
      content: `Nettoyage termine. 🧹 (${deleted} message(s) supprime(s))`,
      flags: MessageFlags.Ephemeral,
    });
  }

  private async getMessagesInRange(
    channel: TextChannel,
    first: Message,
    second: Message,
  ): Promise<Collection<string, Message>> {
    const oldest =
      first.createdTimestamp <= second.createdTimestamp ? first : second;
    const newest =
      first.createdTimestamp <= second.createdTimestamp ? second : first;

    const messages = new Collection<string, Message>();
    messages.set(oldest.id, oldest);
    messages.set(newest.id, newest);

    let before = newest.id;
    while (true) {
      const batch = await channel.messages.fetch({ limit: 100, before });
      if (batch.size === 0) break;

      for (const [, message] of batch) {
        if (message.createdTimestamp < oldest.createdTimestamp) {
          return messages;
        }
        messages.set(message.id, message);
      }

      const last = batch.last();
      if (!last) break;
      before = last.id;
    }

    return messages;
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
