import { Op } from "sequelize";
import { Sanction, SanctionType } from "../models/Sanction";

export interface SanctionDTO {
  id: string;
  guildID: string;
  userID: string;
  moderatorID: string;
  type: SanctionType;
  reason: string;
  warnID: string | null;
  isActive: boolean;
  durationMs: number | null;
  createdAt: number;
  expiresAt: number | null;
}

export interface CreateSanctionInput {
  guildID: string;
  userID: string;
  moderatorID: string;
  type: SanctionType;
  reason: string;
  warnID?: string | null;
  isActive?: boolean;
  durationMs?: number | null;
  createdAt?: number;
  expiresAt?: number | null;
}

export interface UpdateSanctionInput {
  type?: SanctionType;
  reason?: string;
  isActive?: boolean;
  durationMs?: number | null;
  expiresAt?: number | null;
}

function toDTO(row: Sanction): SanctionDTO {
  return {
    id: row.id,
    guildID: row.guildID,
    userID: row.userID,
    moderatorID: row.moderatorID,
    type: row.type,
    reason: row.reason,
    warnID: row.warnID ?? null,
    isActive: row.isActive,
    durationMs: row.durationMs === null ? null : Number(row.durationMs),
    createdAt: Number(row.createdAt),
    expiresAt: row.expiresAt === null ? null : Number(row.expiresAt),
  };
}

export async function createSanction(input: CreateSanctionInput): Promise<SanctionDTO> {
  const createdAt = input.createdAt ?? Date.now();
  const durationMs = input.durationMs ?? null;
  const row = await Sanction.create({
    guildID: input.guildID,
    userID: input.userID,
    moderatorID: input.moderatorID,
    type: input.type,
    reason: input.reason,
    warnID: input.warnID ?? null,
    isActive: input.isActive ?? true,
    durationMs,
    createdAt,
    expiresAt: input.expiresAt ?? (durationMs ? createdAt + durationMs : null),
  } as any);
  return toDTO(row);
}

export async function listSanctions(
  guildID: string,
  userID?: string,
  options?: { activeOnly?: boolean },
): Promise<SanctionDTO[]> {
  const where = {
    guildID,
    ...(userID ? { userID } : {}),
    ...(options?.activeOnly
      ? {
          isActive: true,
          [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: Date.now() } }],
        }
      : {}),
  };

  const rows = await Sanction.findAll({
    where: where as any,
    order: [["createdAt", "DESC"]],
  });
  return rows.map(toDTO);
}

export async function revokeSanction(guildID: string, sanctionID: string): Promise<SanctionDTO | null> {
  const row = await Sanction.findOne({ where: { guildID, id: sanctionID } });
  if (!row) return null;
  await row.update({
    isActive: false,
    expiresAt: row.expiresAt ?? Date.now(),
  });
  return toDTO(row);
}

export async function updateSanction(
  guildID: string,
  sanctionID: string,
  patch: UpdateSanctionInput,
): Promise<SanctionDTO | null> {
  const row = await Sanction.findOne({ where: { guildID, id: sanctionID } });
  if (!row) return null;

  const nextDurationMs = patch.durationMs !== undefined ? patch.durationMs : row.durationMs;
  const nextExpiresAt = patch.expiresAt !== undefined
    ? patch.expiresAt
    : patch.durationMs !== undefined
      ? (patch.durationMs === null ? null : Number(row.createdAt) + patch.durationMs)
      : row.expiresAt;

  await row.update({
    type: patch.type ?? row.type,
    reason: patch.reason ?? row.reason,
    isActive: patch.isActive ?? row.isActive,
    durationMs: nextDurationMs,
    expiresAt: nextExpiresAt,
  });

  return toDTO(row);
}
