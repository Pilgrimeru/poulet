import { messageSnapshotService } from "@/api";
import { Event } from "@/discord/types";
import { Message, PartialMessage } from "discord.js";

export default new Event("messageDelete", async (message: Message | PartialMessage) => {
  if (message.author?.bot || !message.guild) return;
  await messageSnapshotService.markDeleted(message.id);
});
