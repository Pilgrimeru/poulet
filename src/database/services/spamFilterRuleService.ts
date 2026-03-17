import {
  SpamFilterRule,
  SpamFilterRuleAttributes,
} from "@/database/models";
import { nanoid } from "nanoid";

export type SpamFilterRuleDTO = Omit<SpamFilterRuleAttributes, "channelIDs"> & {
  channelIDs: string[];
};

class SpamFilterRuleService {
  private serializeChannelIDs(channelIDs: string[]): string {
    return JSON.stringify(channelIDs);
  }

  private parseChannelIDs(value: string): string[] {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((entry) => typeof entry === "string")
        : [];
    } catch {
      return [];
    }
  }

  private toDTO(row: SpamFilterRule): SpamFilterRuleDTO {
    return {
      id: row.id,
      guildID: row.guildID,
      name: row.name,
      description: row.description,
      mode: row.mode,
      channelIDs: this.parseChannelIDs(row.channelIDs),
      messageLimit: row.messageLimit,
      intervalInSec: row.intervalInSec,
      punishmentDurationInSec: row.punishmentDurationInSec,
      enabled: row.enabled,
    };
  }

  private async ensureDefaultRule(guildID: string): Promise<void> {
    const count = await SpamFilterRule.count({ where: { guildID } });
    if (count > 0) return;

    await this.createRule({
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

  async getRulesByGuildID(guildID: string): Promise<SpamFilterRuleDTO[]> {
    await this.ensureDefaultRule(guildID);
    const rows = await SpamFilterRule.findAll({ where: { guildID } });
    return rows.map((row) => this.toDTO(row));
  }

  async getRuleByID(guildID: string, id: string): Promise<SpamFilterRuleDTO | null> {
    const row = await SpamFilterRule.findOne({ where: { guildID, id } });
    return row ? this.toDTO(row) : null;
  }

  async createRule(
    input: Omit<SpamFilterRuleDTO, "id">,
  ): Promise<SpamFilterRuleDTO> {
    const row = await SpamFilterRule.create({
      id: nanoid(10),
      guildID: input.guildID,
      name: input.name,
      description: input.description,
      mode: input.mode,
      channelIDs: this.serializeChannelIDs(input.channelIDs),
      messageLimit: input.messageLimit,
      intervalInSec: input.intervalInSec,
      punishmentDurationInSec: input.punishmentDurationInSec,
      enabled: input.enabled,
    });
    return this.toDTO(row);
  }

  async updateRule(
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
      channelIDs:
        patch.channelIDs !== undefined
          ? this.serializeChannelIDs(patch.channelIDs)
          : row.channelIDs,
      messageLimit: patch.messageLimit ?? row.messageLimit,
      intervalInSec: patch.intervalInSec ?? row.intervalInSec,
      punishmentDurationInSec:
        patch.punishmentDurationInSec ?? row.punishmentDurationInSec,
      enabled: patch.enabled ?? row.enabled,
    });

    return this.toDTO(row);
  }

  async deleteRule(guildID: string, id: string): Promise<boolean> {
    const deleted = await SpamFilterRule.destroy({ where: { guildID, id } });
    return deleted > 0;
  }
}

export const spamFilterRuleService = new SpamFilterRuleService();
