import { nanoid } from "nanoid";
import { SpamFilterRule } from "../db/models/SpamFilterRule";

export type SpamFilterMode = "whitelist" | "blacklist";

export interface SpamFilterRuleDTO {
  id: string;
  guildID: string;
  name: string;
  description: string;
  mode: SpamFilterMode;
  channelIDs: string[];
  messageLimit: number;
  intervalInSec: number;
  punishmentDurationInSec: number;
  enabled: boolean;
}

function parseChannelIDs(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((e) => typeof e === "string") : [];
  } catch {
    return [];
  }
}

function toDTO(row: SpamFilterRule): SpamFilterRuleDTO {
  return {
    id: row.id,
    guildID: row.guildID,
    name: row.name,
    description: row.description,
    mode: row.mode as SpamFilterMode,
    channelIDs: parseChannelIDs(row.channelIDs),
    messageLimit: row.messageLimit,
    intervalInSec: row.intervalInSec,
    punishmentDurationInSec: row.punishmentDurationInSec,
    enabled: row.enabled,
  };
}

async function ensureDefaultRule(guildID: string): Promise<void> {
  const count = await SpamFilterRule.count({ where: { guildID } });
  if (count > 0) return;
  await createRule({
    guildID,
    name: "Filtre principal",
    description: "Regle anti-spam globale du serveur",
    mode: "blacklist",
    channelIDs: [],
    messageLimit: 3,
    intervalInSec: 3,
    punishmentDurationInSec: 300,
    enabled: true,
  });
}

export async function getRulesByGuildID(guildID: string): Promise<SpamFilterRuleDTO[]> {
  await ensureDefaultRule(guildID);
  const rows = await SpamFilterRule.findAll({ where: { guildID } });
  return rows.map(toDTO);
}

export async function getRuleByID(guildID: string, id: string): Promise<SpamFilterRuleDTO | null> {
  const row = await SpamFilterRule.findOne({ where: { guildID, id } });
  return row ? toDTO(row) : null;
}

export async function createRule(input: Omit<SpamFilterRuleDTO, "id">): Promise<SpamFilterRuleDTO> {
  const row = await SpamFilterRule.create({
    id: nanoid(10),
    guildID: input.guildID,
    name: input.name,
    description: input.description,
    mode: input.mode,
    channelIDs: JSON.stringify(input.channelIDs),
    messageLimit: input.messageLimit,
    intervalInSec: input.intervalInSec,
    punishmentDurationInSec: input.punishmentDurationInSec,
    enabled: input.enabled,
  } as any);
  return toDTO(row);
}

export async function updateRule(
  guildID: string,
  id: string,
  patch: Partial<Omit<SpamFilterRuleDTO, "id" | "guildID">>,
): Promise<SpamFilterRuleDTO | null> {
  const row = await SpamFilterRule.findOne({ where: { guildID, id } });
  if (!row) return null;

  await row.update({
    name: patch.name ?? row.name,
    description: patch.description ?? row.description,
    mode: patch.mode ?? row.mode,
    channelIDs: patch.channelIDs !== undefined ? JSON.stringify(patch.channelIDs) : row.channelIDs,
    messageLimit: patch.messageLimit ?? row.messageLimit,
    intervalInSec: patch.intervalInSec ?? row.intervalInSec,
    punishmentDurationInSec: patch.punishmentDurationInSec ?? row.punishmentDurationInSec,
    enabled: patch.enabled ?? row.enabled,
  });

  return toDTO(row);
}

export async function deleteRule(guildID: string, id: string): Promise<boolean> {
  const deleted = await SpamFilterRule.destroy({ where: { guildID, id } });
  return deleted > 0;
}
