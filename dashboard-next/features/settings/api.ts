import type { ChannelEntry } from "@/types";
import type { RoleEntry } from "@/services/discordMetaService";
import type { ChannelRuleDTO, GuildSettingsDTO, SpamRuleDTO } from "./types";

export async function fetchSettings(guildID: string): Promise<GuildSettingsDTO> {
  const response = await fetch(`/api/guilds/${guildID}/settings`);
  if (!response.ok) throw new Error("Failed to fetch settings");
  return response.json();
}

export async function patchSettings(guildID: string, patch: Partial<GuildSettingsDTO>): Promise<GuildSettingsDTO> {
  const response = await fetch(`/api/guilds/${guildID}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error("Failed to update settings");
  return response.json();
}

export async function fetchAllChannels(guildID: string): Promise<ChannelEntry[]> {
  const response = await fetch(`/api/guilds/${guildID}/all-channels`);
  if (!response.ok) throw new Error("Failed to fetch channels");
  return response.json();
}

export async function fetchRoles(guildID: string): Promise<RoleEntry[]> {
  const response = await fetch(`/api/guilds/${guildID}/discord-roles`);
  if (!response.ok) throw new Error("Failed to fetch roles");
  return response.json();
}

export async function fetchSpamRules(guildID: string): Promise<SpamRuleDTO[]> {
  const response = await fetch(`/api/guilds/${guildID}/spam-rules`);
  if (!response.ok) throw new Error("Failed to fetch spam rules");
  return response.json();
}

export async function patchSpamRule(guildID: string, id: string, patch: Partial<SpamRuleDTO>): Promise<SpamRuleDTO> {
  const response = await fetch(`/api/guilds/${guildID}/spam-rules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error("Failed to update spam rule");
  return response.json();
}

export async function deleteSpamRule(guildID: string, id: string): Promise<void> {
  await fetch(`/api/guilds/${guildID}/spam-rules/${id}`, { method: "DELETE" });
}

export async function createSpamRule(guildID: string): Promise<SpamRuleDTO> {
  const response = await fetch(`/api/guilds/${guildID}/spam-rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      guildID,
      name: "Nouveau filtre",
      description: "",
      mode: "blacklist",
      channelIDs: [],
      messageLimit: 5,
      intervalInSec: 5,
      punishmentDurationInSec: 300,
      enabled: true,
    }),
  });
  if (!response.ok) throw new Error("Failed to create spam rule");
  return response.json();
}

export async function fetchChannelRules(guildID: string): Promise<ChannelRuleDTO[]> {
  const response = await fetch(`/api/guilds/${guildID}/channel-rules`);
  if (!response.ok) throw new Error("Failed to fetch channel rules");
  return response.json();
}

export async function upsertChannelRule(guildID: string, channelID: string, patch: Partial<Omit<ChannelRuleDTO, "id" | "guildID" | "channelID">>): Promise<ChannelRuleDTO> {
  const response = await fetch(`/api/guilds/${guildID}/channel-rules/${channelID}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error("Failed to upsert channel rule");
  return response.json();
}

export async function deleteChannelRule(guildID: string, channelID: string): Promise<void> {
  await fetch(`/api/guilds/${guildID}/channel-rules/${channelID}`, { method: "DELETE" });
}
