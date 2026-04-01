import { FlaggedMessage } from "../models/FlaggedMessage";

export interface ContextMessage {
  id: string;
  authorID: string;
  authorUsername: string;
  authorAvatarURL: string;
  content: string;
  createdAt: number;
  referencedMessageID: string | null;
  referencedAuthorID?: string | null;
  referencedAuthorUsername?: string | null;
  referencedContent?: string | null;
}

export interface FlaggedMessageDTO {
  id: string;
  guildID: string;
  channelID: string;
  messageID: string;
  reporterID: string;
  targetUserID: string;
  status: string;
  aiAnalysis: unknown;
  sanctionID: string | null;
  context: ContextMessage[] | null;
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
  sanctionID?: string | null;
  context?: ContextMessage[] | null;
  moderatorID?: string | null;
  createdAt?: number;
}

export interface UpdateFlaggedMessageInput {
  status?: string;
  aiAnalysis?: unknown;
  sanctionID?: string | null;
  context?: ContextMessage[] | null;
  moderatorID?: string | null;
}

function parseJSON(value: string | null): unknown {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed && "targetID" in parsed && !("victimUserID" in parsed)) parsed["victimUserID"] = parsed["targetID"];
    return parsed;
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
    sanctionID: row.sanctionID ?? null,
    context: parseJSON(row.context) as ContextMessage[] | null,
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
    sanctionID: input.sanctionID ?? null,
    context: input.context === undefined ? null : JSON.stringify(input.context),
    moderatorID: input.moderatorID ?? null,
    createdAt: input.createdAt ?? Date.now(),
  } as any);
  return toDTO(row);
}

export async function listFlaggedMessages(
  guildID: string,
  options?: { targetUserID?: string; status?: string },
): Promise<FlaggedMessageDTO[]> {
  const rows = await FlaggedMessage.findAll({
    where: {
      guildID,
      ...(options?.targetUserID ? { targetUserID: options.targetUserID } : {}),
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
  const updates: Record<string, unknown> = {};
  if (patch.status !== undefined) updates["status"] = patch.status;
  if (patch.aiAnalysis !== undefined) updates["aiAnalysis"] = JSON.stringify(patch.aiAnalysis);
  if (patch.sanctionID !== undefined) updates["sanctionID"] = patch.sanctionID;
  if (patch.context !== undefined) updates["context"] = patch.context === null ? null : JSON.stringify(patch.context);
  if (patch.moderatorID !== undefined) updates["moderatorID"] = patch.moderatorID;
  await row.update(updates);
  return toDTO(row);
}
