import { nanoid } from "nanoid";
import { ChannelRule } from "../models/ChannelRule";

export interface ChannelRuleDTO {
  id: string;
  guildID: string;
  channelID: string;
  autoThread: boolean;
  oneMessageLimit: boolean;
}

function toDTO(row: ChannelRule): ChannelRuleDTO {
  return {
    id: row.id,
    guildID: row.guildID,
    channelID: row.channelID,
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

  if (row) {
    await row.update({
      autoThread: patch.autoThread ?? row.autoThread,
      oneMessageLimit: patch.oneMessageLimit ?? row.oneMessageLimit,
    });
  } else {
    row = await ChannelRule.create({
      id: nanoid(10),
      guildID,
      channelID,
      autoThread: patch.autoThread ?? false,
      oneMessageLimit: patch.oneMessageLimit ?? false,
    });
  }

  return toDTO(row);
}

export async function deleteRule(guildID: string, channelID: string): Promise<boolean> {
  const deleted = await ChannelRule.destroy({ where: { guildID, channelID } });
  return deleted > 0;
}
