import { Op } from "sequelize";
import { Warn, WarnSeverity } from "../models/Warn";

export interface WarnDTO {
  id: string;
  guildID: string;
  userID: string;
  moderatorID: string;
  reason: string;
  severity: WarnSeverity;
  isActive: boolean;
  createdAt: number;
  expiresAt: number | null;
}

export interface CreateWarnInput {
  guildID: string;
  userID: string;
  moderatorID: string;
  reason: string;
  severity: WarnSeverity;
  createdAt?: number;
  expiresAt?: number | null;
  isActive?: boolean;
}

const MULTIPLIER_BY_SEVERITY: Record<WarnSeverity, number> = {
  LOW: 0.25,
  MEDIUM: 0.25,
  HIGH: 0.5,
};

function toDTO(row: Warn): WarnDTO {
  return {
    id: row.id,
    guildID: row.guildID,
    userID: row.userID,
    moderatorID: row.moderatorID,
    reason: row.reason,
    severity: row.severity,
    isActive: row.isActive,
    createdAt: Number(row.createdAt),
    expiresAt: row.expiresAt === null ? null : Number(row.expiresAt),
  };
}

export async function createWarn(input: CreateWarnInput): Promise<WarnDTO> {
  const row = await Warn.create({
    guildID: input.guildID,
    userID: input.userID,
    moderatorID: input.moderatorID,
    reason: input.reason,
    severity: input.severity,
    isActive: input.isActive ?? true,
    createdAt: input.createdAt ?? Date.now(),
    expiresAt: input.expiresAt ?? null,
  } as any);
  return toDTO(row);
}

export async function listWarns(guildID: string, userID?: string): Promise<WarnDTO[]> {
  const rows = await Warn.findAll({
    where: { guildID, ...(userID ? { userID } : {}) },
    order: [["createdAt", "DESC"]],
  });
  return rows.map(toDTO);
}

export async function revokeWarn(guildID: string, warnID: string): Promise<WarnDTO | null> {
  const row = await Warn.findOne({ where: { guildID, id: warnID } });
  if (!row) return null;
  await row.update({
    isActive: false,
    expiresAt: row.expiresAt ?? Date.now(),
  });
  return toDTO(row);
}

export async function getActiveMultiplier(guildID: string, userID: string): Promise<number> {
  const rows = await Warn.findAll({
    where: {
      guildID,
      userID,
      isActive: true,
      [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: Date.now() } }],
    },
  });
  const total = rows.reduce((sum, row) => sum + MULTIPLIER_BY_SEVERITY[row.severity], 0);
  return Math.min(7, total);
}
