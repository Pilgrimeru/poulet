import { FlaggedMessage } from "../models/FlaggedMessage";

export interface FlaggedMessageDTO {
  id: string;
  guildID: string;
  channelID: string;
  messageID: string;
  reporterID: string;
  targetUserID: string;
  status: string;
  aiAnalysis: unknown;
  warnID: string | null;
  sanctionID: string | null;
  appealText: string | null;
  appealStatus: string | null;
  appealAt: number | null;
  moderatorID: string | null;
  createdAt: number;
}

export interface CreateFlaggedMessageInput {
  guildID: string;
  channelID: string;
  messageID: string;
  reporterID: string;
  targetUserID: string;
  status?: string;
  aiAnalysis?: unknown;
  warnID?: string | null;
  sanctionID?: string | null;
  appealText?: string | null;
  appealStatus?: string | null;
  appealAt?: number | null;
  moderatorID?: string | null;
  createdAt?: number;
}

export interface UpdateFlaggedMessageInput {
  status?: string;
  aiAnalysis?: unknown;
  warnID?: string | null;
  sanctionID?: string | null;
  appealText?: string | null;
  appealStatus?: string | null;
  appealAt?: number | null;
  moderatorID?: string | null;
}

function parseJSON(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toDTO(row: FlaggedMessage): FlaggedMessageDTO {
  return {
    id: row.id,
    guildID: row.guildID,
    channelID: row.channelID,
    messageID: row.messageID,
    reporterID: row.reporterID,
    targetUserID: row.targetUserID,
    status: row.status,
    aiAnalysis: parseJSON(row.aiAnalysis),
    warnID: row.warnID ?? null,
    sanctionID: row.sanctionID ?? null,
    appealText: row.appealText ?? null,
    appealStatus: row.appealStatus ?? null,
    appealAt: row.appealAt === null ? null : Number(row.appealAt),
    moderatorID: row.moderatorID ?? null,
    createdAt: Number(row.createdAt),
  };
}

export async function createFlaggedMessage(input: CreateFlaggedMessageInput): Promise<FlaggedMessageDTO> {
  const row = await FlaggedMessage.create({
    guildID: input.guildID,
    channelID: input.channelID,
    messageID: input.messageID,
    reporterID: input.reporterID,
    targetUserID: input.targetUserID,
    status: input.status ?? "pending",
    aiAnalysis: input.aiAnalysis === undefined ? null : JSON.stringify(input.aiAnalysis),
    warnID: input.warnID ?? null,
    sanctionID: input.sanctionID ?? null,
    appealText: input.appealText ?? null,
    appealStatus: input.appealStatus ?? null,
    appealAt: input.appealAt ?? null,
    moderatorID: input.moderatorID ?? null,
    createdAt: input.createdAt ?? Date.now(),
  } as any);
  return toDTO(row);
}

export async function listFlaggedMessages(
  guildID: string,
  options?: { targetUserID?: string; appealStatus?: string; status?: string },
): Promise<FlaggedMessageDTO[]> {
  const rows = await FlaggedMessage.findAll({
    where: {
      guildID,
      ...(options?.targetUserID ? { targetUserID: options.targetUserID } : {}),
      ...(options?.appealStatus ? { appealStatus: options.appealStatus } : {}),
      ...(options?.status ? { status: options.status } : {}),
    },
    order: [["createdAt", "DESC"]],
  });
  return rows.map(toDTO);
}

export async function updateFlaggedMessage(
  guildID: string,
  flagID: string,
  patch: UpdateFlaggedMessageInput,
): Promise<FlaggedMessageDTO | null> {
  const row = await FlaggedMessage.findOne({ where: { guildID, id: flagID } });
  if (!row) return null;
  await row.update({
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.aiAnalysis !== undefined ? { aiAnalysis: JSON.stringify(patch.aiAnalysis) } : {}),
    ...(patch.warnID !== undefined ? { warnID: patch.warnID } : {}),
    ...(patch.sanctionID !== undefined ? { sanctionID: patch.sanctionID } : {}),
    ...(patch.appealText !== undefined ? { appealText: patch.appealText } : {}),
    ...(patch.appealStatus !== undefined ? { appealStatus: patch.appealStatus } : {}),
    ...(patch.appealAt !== undefined ? { appealAt: patch.appealAt } : {}),
    ...(patch.moderatorID !== undefined ? { moderatorID: patch.moderatorID } : {}),
  });
  return toDTO(row);
}
