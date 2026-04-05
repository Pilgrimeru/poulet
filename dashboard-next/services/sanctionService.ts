import { Sanction } from "../models/Sanction";

export type { SanctionType, SanctionSeverity, SanctionNature, SanctionState } from "../models/Sanction";
import type { SanctionNature, SanctionSeverity, SanctionState, SanctionType } from "../models/Sanction";

export interface SanctionDTO {
  id: string;
  guildID: string;
  userID: string;
  moderatorID: string;
  type: SanctionType;
  severity: SanctionSeverity;
  nature: SanctionNature;
  state: SanctionState;
  reason: string;
  durationMs: number | null;
  createdAt: number;
}

export interface CreateSanctionInput {
  guildID: string;
  userID: string;
  moderatorID: string;
  type: SanctionType;
  severity: SanctionSeverity;
  nature: SanctionNature;
  reason: string;
  state?: SanctionState;
  durationMs?: number | null;
  createdAt?: number;
}

export interface UpdateSanctionInput {
  type?: SanctionType;
  severity?: SanctionSeverity;
  nature?: SanctionNature;
  state?: SanctionState;
  reason?: string;
  durationMs?: number | null;
}

function toDTO(row: Sanction): SanctionDTO {
  return {
    id: row.id,
    guildID: row.guildID,
    userID: row.userID,
    moderatorID: row.moderatorID,
    type: row.type,
    severity: row.severity,
    nature: row.nature,
    state: row.state,
    reason: row.reason,
    durationMs: row.durationMs === null ? null : Number(row.durationMs),
    createdAt: Number(row.createdAt),
  };
}

export async function createSanction(input: CreateSanctionInput): Promise<SanctionDTO> {
  const row = await Sanction.create({
    guildID: input.guildID,
    userID: input.userID,
    moderatorID: input.moderatorID,
    type: input.type,
    severity: input.severity,
    nature: input.nature,
    state: input.state ?? "created",
    reason: input.reason,
    durationMs: input.durationMs ?? null,
    createdAt: input.createdAt ?? Date.now(),
  } as any);
  return toDTO(row);
}

export async function listSanctions(
  guildID: string,
  userID?: string,
  options?: { state?: SanctionState; limit?: number; offset?: number },
): Promise<{ items: SanctionDTO[]; total: number; hasMore: boolean }> {
  const limit = Math.max(1, Math.min(options?.limit ?? 50, 200));
  const offset = Math.max(0, options?.offset ?? 0);
  const { rows, count } = await Sanction.findAndCountAll({
    where: {
      guildID,
      ...(userID ? { userID } : {}),
      ...(options?.state ? { state: options.state } : {}),
    },
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });
  return {
    items: rows.map(toDTO),
    total: count,
    hasMore: offset + rows.length < count,
  };
}

export async function getSanction(guildID: string, sanctionID: string): Promise<SanctionDTO | null> {
  const row = await Sanction.findOne({ where: { guildID, id: sanctionID } });
  return row ? toDTO(row) : null;
}

export async function revokeSanction(guildID: string, sanctionID: string): Promise<SanctionDTO | null> {
  const row = await Sanction.findOne({ where: { guildID, id: sanctionID } });
  if (!row) return null;
  await row.update({ state: "canceled" });
  return toDTO(row);
}

export async function updateSanction(
  guildID: string,
  sanctionID: string,
  patch: UpdateSanctionInput,
): Promise<SanctionDTO | null> {
  const row = await Sanction.findOne({ where: { guildID, id: sanctionID } });
  if (!row) return null;
  const updates: Record<string, unknown> = {};
  if (patch.type !== undefined) updates["type"] = patch.type;
  if (patch.severity !== undefined) updates["severity"] = patch.severity;
  if (patch.nature !== undefined) updates["nature"] = patch.nature;
  if (patch.state !== undefined) updates["state"] = patch.state;
  if (patch.reason !== undefined) updates["reason"] = patch.reason;
  if (patch.durationMs !== undefined) updates["durationMs"] = patch.durationMs;
  await row.update(updates);
  return toDTO(row);
}

/**
 * Calculate the multiplier for a user based on their active sanctions.
 * A sanction is "active" if state === 'created' and not expired (createdAt + durationMs > now, or durationMs is null).
 * @param sanctionDurationMs Guild setting for sanction validity window (null = never expires)
 */
export async function getActiveMultiplier(
  guildID: string,
  userID: string,
  sanctionDurationMs: number | null,
): Promise<number> {
  const rows = await Sanction.findAll({
    where: { guildID, userID, state: "created" },
  });

  const now = Date.now();
  const active = rows.filter((row) => {
    const createdAt = Number(row.createdAt);
    const duration = row.durationMs === null ? null : Number(row.durationMs);
    if (duration === null && sanctionDurationMs === null) {
      return true;
    }
    if (duration === null) {
      return now - createdAt < sanctionDurationMs!;
    }
    return now - createdAt < duration;
  });

  const WEIGHT: Record<SanctionSeverity, number> = {
    NONE: 0,
    LOW: 0.25,
    MEDIUM: 0.25,
    HIGH: 0.5,
    UNFORGIVABLE: 0.5,
  };

  const total = active.reduce((sum, row) => sum + WEIGHT[row.severity], 0);
  return Math.min(7, 1 + total);
}
