import { nanoid } from "nanoid";
import { ChannelRule, ChannelRuleMessageFilter } from "../db/models/ChannelRule";

export interface ChannelRuleDTO {
  id: string;
  guildID: string;
  channelID: string;
  reactEmojis: string[];
  reactFilter: ChannelRuleMessageFilter[];
  autoThread: boolean;
  oneMessageLimit: boolean;
}

function parseJSON<T>(value: string, fallback: T): T {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function toDTO(row: ChannelRule): ChannelRuleDTO {
  return {
    id: row.id,
    guildID: row.guildID,
    channelID: row.channelID,
    reactEmojis: parseJSON<string[]>(row.reactEmojis, []),
    reactFilter: parseJSON<ChannelRuleMessageFilter[]>(row.reactFilter, ["all"]),
    autoThread: row.autoThread,
    oneMessageLimit: row.oneMessageLimit,
  };
}

export async function getRulesByGuildID(guildID: string): Promise<ChannelRuleDTO[]> {
  const rows = await ChannelRule.findAll({ where: { guildID } });
  return rows.map(toDTO);
}

export async function getRuleByChannel(guildID: string, channelID: string): Promise<ChannelRuleDTO | null> {
  const row = await ChannelRule.findOne({ where: { guildID, channelID } });
  return row ? toDTO(row) : null;
}

export async function getRuleByID(guildID: string, id: string): Promise<ChannelRuleDTO | null> {
  const row = await ChannelRule.findOne({ where: { guildID, id } });
  return row ? toDTO(row) : null;
}

export async function upsertRule(
  guildID: string,
  channelID: string,
  patch: Partial<Omit<ChannelRuleDTO, "id" | "guildID" | "channelID">>,
): Promise<ChannelRuleDTO> {
  let row = await ChannelRule.findOne({ where: { guildID, channelID } });

  if (!row) {
    row = await ChannelRule.create({
      id: nanoid(10),
      guildID,
      channelID,
      reactEmojis: JSON.stringify(patch.reactEmojis ?? []),
      reactFilter: JSON.stringify(patch.reactFilter ?? ["all"]),
      autoThread: patch.autoThread ?? false,
      oneMessageLimit: patch.oneMessageLimit ?? false,
    });
  } else {
    await row.update({
      reactEmojis: patch.reactEmojis !== undefined ? JSON.stringify(patch.reactEmojis) : row.reactEmojis,
      reactFilter: patch.reactFilter !== undefined ? JSON.stringify(patch.reactFilter) : row.reactFilter,
      autoThread: patch.autoThread ?? row.autoThread,
      oneMessageLimit: patch.oneMessageLimit ?? row.oneMessageLimit,
    });
  }

  return toDTO(row);
}

export async function deleteRule(guildID: string, channelID: string): Promise<boolean> {
  const deleted = await ChannelRule.destroy({ where: { guildID, channelID } });
  return deleted > 0;
}
