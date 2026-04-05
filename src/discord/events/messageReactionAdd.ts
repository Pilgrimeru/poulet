import { guildSettingsService } from "@/api";
import { Event } from "@/discord/types";
import { MessageReaction, TextChannel, User } from "discord.js";

// Track message IDs already forwarded to avoid duplicates (guildID:messageID)
const forwarded = new Set<string>();

export default new Event("messageReactionAdd", async (reaction: MessageReaction, user: User) => {
  if (user.bot) return;

  // Fetch partial reaction/message if needed
  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }
  if (reaction.message.partial) {
    try { await reaction.message.fetch(); } catch { return; }
  }

  const message = reaction.message;
  if (!message.guild || !message.channel) return;

  const guildID = message.guild.id;
  const settings = await guildSettingsService.getByGuildID(guildID);

  if (!settings.starboardChannelID || !settings.starboardEmoji) return;

  // Match emoji: unicode (name) or custom (id or toString)
  const emoji = reaction.emoji;
  const emojiStr = emoji.id ? emoji.toString() : (emoji.name ?? "");
  if (emojiStr !== settings.starboardEmoji && (emoji.name ?? "") !== settings.starboardEmoji) return;

  const count = reaction.count ?? 0;
  if (count < settings.starboardThreshold) return;

  const key = `${guildID}:${message.id}`;
  if (forwarded.has(key)) return;
  forwarded.add(key);

  try {
    const starboardChannel = message.guild.channels.cache.get(settings.starboardChannelID);
    if (!starboardChannel || !starboardChannel.isTextBased()) return;

    await message.forward(starboardChannel as TextChannel);
  } catch (error) {
    forwarded.delete(key);
    console.error("[starboard] Erreur lors du transfert du message :", error);
  }
});
