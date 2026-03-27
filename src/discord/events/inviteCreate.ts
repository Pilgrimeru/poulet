import { Invite } from "discord.js";
import { Event } from "@/discord/types";
import { cacheGuildInvites } from "@/services/inviteTrackerService";

export default new Event("inviteCreate", async (invite: Invite) => {
  if (invite.guild) await cacheGuildInvites(invite.guild as any);
});
