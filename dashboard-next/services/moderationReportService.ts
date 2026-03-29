import { ModerationReport } from "../models/ModerationReport";

export interface ModerationReportDTO {
  id: string;
  guildID: string;
  reporterID: string;
  targetUserID: string;
  ticketChannelID: string;
  status: string;
  reporterSummary: string;
  aiQuestions: string[];
  aiQQOQCCP: string | null;
  confirmationCount: number;
  warnID: string | null;
  sanctionID: string | null;
  appealText: string | null;
  appealStatus: string | null;
  appealAt: number | null;
  moderatorID: string | null;
  createdAt: number;
}

export interface CreateModerationReportInput {
  guildID: string;
  reporterID: string;
  targetUserID: string;
  ticketChannelID: string;
  status?: string;
  reporterSummary: string;
  aiQuestions?: string[];
  aiQQOQCCP?: string | null;
  confirmationCount?: number;
  warnID?: string | null;
  sanctionID?: string | null;
  appealText?: string | null;
  appealStatus?: string | null;
  appealAt?: number | null;
  moderatorID?: string | null;
  createdAt?: number;
}

export interface UpdateModerationReportInput {
  status?: string;
  reporterSummary?: string;
  aiQuestions?: string[];
  aiQQOQCCP?: string | null;
  confirmationCount?: number;
  warnID?: string | null;
  sanctionID?: string | null;
  appealText?: string | null;
  appealStatus?: string | null;
  appealAt?: number | null;
  moderatorID?: string | null;
}

function parseQuestions(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toDTO(row: ModerationReport): ModerationReportDTO {
  return {
    id: row.id,
    guildID: row.guildID,
    reporterID: row.reporterID,
    targetUserID: row.targetUserID,
    ticketChannelID: row.ticketChannelID,
    status: row.status,
    reporterSummary: row.reporterSummary,
    aiQuestions: parseQuestions(row.aiQuestions),
    aiQQOQCCP: row.aiQQOQCCP ?? null,
    confirmationCount: row.confirmationCount,
    warnID: row.warnID ?? null,
    sanctionID: row.sanctionID ?? null,
    appealText: row.appealText ?? null,
    appealStatus: row.appealStatus ?? null,
    appealAt: row.appealAt === null ? null : Number(row.appealAt),
    moderatorID: row.moderatorID ?? null,
    createdAt: Number(row.createdAt),
  };
}

export async function createReport(input: CreateModerationReportInput): Promise<ModerationReportDTO> {
  const row = await ModerationReport.create({
    guildID: input.guildID,
    reporterID: input.reporterID,
    targetUserID: input.targetUserID,
    ticketChannelID: input.ticketChannelID,
    status: input.status ?? "awaiting_ai",
    reporterSummary: input.reporterSummary,
    aiQuestions: JSON.stringify(input.aiQuestions ?? []),
    aiQQOQCCP: input.aiQQOQCCP ?? null,
    confirmationCount: input.confirmationCount ?? 0,
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

export async function getReport(guildID: string, reportID: string): Promise<ModerationReportDTO | null> {
  const row = await ModerationReport.findOne({ where: { guildID, id: reportID } });
  return row ? toDTO(row) : null;
}

export async function getReportByChannel(guildID: string, channelID: string): Promise<ModerationReportDTO | null> {
  const row = await ModerationReport.findOne({ where: { guildID, ticketChannelID: channelID } });
  return row ? toDTO(row) : null;
}

export async function updateReport(
  guildID: string,
  reportID: string,
  patch: UpdateModerationReportInput,
): Promise<ModerationReportDTO | null> {
  const row = await ModerationReport.findOne({ where: { guildID, id: reportID } });
  if (!row) return null;
  await row.update({
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.reporterSummary !== undefined ? { reporterSummary: patch.reporterSummary } : {}),
    ...(patch.aiQuestions !== undefined ? { aiQuestions: JSON.stringify(patch.aiQuestions) } : {}),
    ...(patch.aiQQOQCCP !== undefined ? { aiQQOQCCP: patch.aiQQOQCCP } : {}),
    ...(patch.confirmationCount !== undefined ? { confirmationCount: patch.confirmationCount } : {}),
    ...(patch.warnID !== undefined ? { warnID: patch.warnID } : {}),
    ...(patch.sanctionID !== undefined ? { sanctionID: patch.sanctionID } : {}),
    ...(patch.appealText !== undefined ? { appealText: patch.appealText } : {}),
    ...(patch.appealStatus !== undefined ? { appealStatus: patch.appealStatus } : {}),
    ...(patch.appealAt !== undefined ? { appealAt: patch.appealAt } : {}),
    ...(patch.moderatorID !== undefined ? { moderatorID: patch.moderatorID } : {}),
  });
  return toDTO(row);
}

export async function listReports(
  guildID: string,
  options?: { appealStatus?: string; status?: string },
): Promise<ModerationReportDTO[]> {
  const rows = await ModerationReport.findAll({
    where: {
      guildID,
      ...(options?.appealStatus ? { appealStatus: options.appealStatus } : {}),
      ...(options?.status ? { status: options.status } : {}),
    },
    order: [["createdAt", "DESC"]],
  });
  return rows.map(toDTO);
}
