import { nanoid } from "nanoid";
import { AutoResponse } from "../models/AutoResponse";
import type { TriggerGroup } from "../models/AutoResponse";

export type { TriggerGroup };

export type ChannelMode = "all" | "whitelist" | "blacklist";

export interface AutoResponseDTO {
  id: string;
  guildID: string;
  name: string;
  enabled: boolean;
  /**
   * Trigger groups. Each group is AND'd internally; groups are OR'd together.
   * Example: group1=(keyword:"hello" AND hasAttachment:true) OR group2=(regex:"good morning")
   */
  triggerGroups: TriggerGroup[];
  channelMode: ChannelMode;
  channelIDs: string[];
  responseEmojis: string[];
  responseMessage: string | null;
  responseReply: boolean;
}

function parseJSON<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toDTO(row: AutoResponse): AutoResponseDTO {
  return {
    id: row.id,
    guildID: row.guildID,
    name: row.name,
    enabled: row.enabled,
    triggerGroups: parseJSON<TriggerGroup[]>(row.triggerGroups, []),
    channelMode: (row.channelMode as ChannelMode) ?? "all",
    channelIDs: parseJSON<string[]>(row.channelIDs, []),
    responseEmojis: parseJSON<string[]>(row.responseEmojis, []),
    responseMessage: row.responseMessage ?? null,
    responseReply: row.responseReply,
  };
}

export async function getAutoResponsesByGuildID(guildID: string): Promise<AutoResponseDTO[]> {
  const rows = await AutoResponse.findAll({ where: { guildID } });
  return rows.map(toDTO);
}

export async function getAutoResponseByID(guildID: string, id: string): Promise<AutoResponseDTO | null> {
  const row = await AutoResponse.findOne({ where: { guildID, id } });
  return row ? toDTO(row) : null;
}

export async function createAutoResponse(guildID: string, patch: Partial<Omit<AutoResponseDTO, "id" | "guildID">> = {}): Promise<AutoResponseDTO> {
  const row = await AutoResponse.create({
    id: nanoid(10),
    guildID,
    name: patch.name ?? "Nouvelle règle",
    enabled: patch.enabled ?? true,
    triggerGroups: JSON.stringify(patch.triggerGroups ?? []),
    channelMode: patch.channelMode ?? "all",
    channelIDs: JSON.stringify(patch.channelIDs ?? []),
    responseEmojis: JSON.stringify(patch.responseEmojis ?? []),
    responseMessage: patch.responseMessage ?? null,
    responseReply: patch.responseReply ?? true,
  });
  return toDTO(row);
}

export async function updateAutoResponse(
  guildID: string,
  id: string,
  patch: Partial<Omit<AutoResponseDTO, "id" | "guildID">>,
): Promise<AutoResponseDTO | null> {
  const row = await AutoResponse.findOne({ where: { guildID, id } });
  if (!row) return null;

  await row.update({
    name: patch.name ?? row.name,
    enabled: patch.enabled ?? row.enabled,
    triggerGroups: patch.triggerGroups !== undefined ? JSON.stringify(patch.triggerGroups) : row.triggerGroups,
    channelMode: patch.channelMode ?? row.channelMode,
    channelIDs: patch.channelIDs !== undefined ? JSON.stringify(patch.channelIDs) : row.channelIDs,
    responseEmojis: patch.responseEmojis !== undefined ? JSON.stringify(patch.responseEmojis) : row.responseEmojis,
    responseMessage: patch.responseMessage !== undefined ? patch.responseMessage : row.responseMessage,
    responseReply: patch.responseReply !== undefined ? patch.responseReply : row.responseReply,
  });

  return toDTO(row);
}

export async function deleteAutoResponse(guildID: string, id: string): Promise<boolean> {
  const deleted = await AutoResponse.destroy({ where: { guildID, id } });
  return deleted > 0;
}
