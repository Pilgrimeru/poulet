import { sanctionApiService, type SanctionSeverity } from "@/api/sanctionApiService";
import { formatAttachmentsSuffix } from "@/discord/components/moderation/messageFormatting";
import { SystemMessage } from "@langchain/core/messages";
import { runWithTools } from "../core/runtime";
import { flagChatPrompt, summaryChatPrompt } from "./prompts";
import { buildSummaryInputContext, getSourceReportTimezone, postProcessSummaryResult } from "./reportContext";
import { FlagAnalysisSchema, SummarySchema } from "./schemas";
import type { FlagAnalysisInput, FlagAnalysisResult, ReportAnalysisInput, SummaryResult } from "./types";

const SEVERITY_ORDER: SanctionSeverity[] = ["NONE", "LOW", "MEDIUM", "HIGH", "UNFORGIVABLE"];

function severityIndex(s: SanctionSeverity): number {
  return SEVERITY_ORDER.indexOf(s);
}

function nextSeverity(s: SanctionSeverity): SanctionSeverity {
  return SEVERITY_ORDER[Math.min(severityIndex(s) + 1, SEVERITY_ORDER.length - 1)];
}

function formatUserRef(userID?: string | null): string {
  return userID ? `<@${userID}>` : "<@unknown>";
}

function escapeInlineValue(value: string | null | undefined): string {
  return (value ?? "").replaceAll(/\s+/g, " ").trim();
}

function buildParticipantAliasesText(input: FlagAnalysisInput): string {
  const lines: string[] = [];
  const seen = new Set<string>();

  const pushAlias = (userID: string | null | undefined, ...aliases: Array<string | null | undefined>) => {
    if (!userID || seen.has(userID)) return;
    const cleaned = aliases.map(escapeInlineValue).filter(Boolean);
    const uniqueAliases = [...new Set(cleaned)];
    seen.add(userID);
    lines.push(uniqueAliases.length > 0
      ? `- <@${userID}> | alias=${uniqueAliases.join(" | ")}`
      : `- <@${userID}>`);
  };

  pushAlias(input.reporterID, input.reporterUsername, input.reporterDisplayName);
  pushAlias(input.targetUserID, input.targetUsername, input.targetDisplayName);

  for (const mention of input.messageMentions ?? []) {
    pushAlias(mention.id, mention.username, mention.displayName);
  }

  for (const message of input.contextMessages) {
    pushAlias(message.authorID, message.authorUsername);
    pushAlias(message.referencedAuthorID, message.referencedAuthorUsername);
  }

  return lines.length > 0 ? lines.join("\n") : "Aucun alias utile.";
}

async function buildActiveSanctionsContext(
  guildID: string,
  targetUserID: string,
  anchorTimestamp: number,
): Promise<string> {
  const allActive = await sanctionApiService.list(guildID, { userID: targetUserID, state: "created" }).catch(() => []);
  const priorSanctions = allActive
    .filter((sanction) => sanction.createdAt < anchorTimestamp)
    .toSorted((a, b) => b.createdAt - a.createdAt);

  if (priorSanctions.length === 0) {
    return "Aucune sanction active anterieure pertinente.";
  }

  return priorSanctions.map((sanction) =>
    [
      `- id=${sanction.id}`,
      `date=${new Date(sanction.createdAt).toISOString()}`,
      `type=${sanction.type}`,
      `severity=${sanction.severity}`,
      `nature=${sanction.nature}`,
      `reason=${sanction.reason}`,
      `durationMs=${sanction.durationMs ?? "null"}`,
    ].join(" | "),
  ).join("\n");
}

async function applyRecidivismEscalation(
  result: SummaryResult,
  guildID: string,
  targetUserID: string,
  anchorTimestamp: number,
): Promise<SummaryResult> {
  if (!result.isViolation || result.severity === "NONE") return result;

  const allActive = await sanctionApiService.list(guildID, { userID: targetUserID, state: "created" }).catch(() => []);
  // Only count sanctions that predate the violation — excludes sanctions issued after the fact
  const priorSanctions = allActive.filter((s) => s.createdAt < anchorTimestamp);

  if (priorSanctions.length === 0) return result;

  let severity: SanctionSeverity = result.severity;

  const maxPriorSeverityIndex = priorSanctions.reduce(
    (max, s) => Math.max(max, severityIndex(s.severity)),
    0,
  );

  // Escalate by one level when the prior sanction is at least as severe as the current violation
  if (maxPriorSeverityIndex >= severityIndex(severity)) {
    severity = nextSeverity(severity);
  }

  if (severity === result.severity) return result;

  console.log(`[ai] recidivism escalation: ${result.severity} → ${severity} (${priorSanctions.length} prior sanctions)`);
  return { ...result, severity };
}

export async function analyzeFlag(input: FlagAnalysisInput): Promise<FlagAnalysisResult> {
  const contextText = input.contextMessages
    .map((message) => {
      const isSanctioned = message.authorID === input.targetUserID
        && message.id != null
        && (input.alreadySanctionedMessageIDs?.has(message.id) ?? false);
      const sanctionedSuffix = isSanctioned ? " [DÉJÀ SANCTIONNÉ]" : "";
      const authorAlias = escapeInlineValue(message.authorUsername);
      const base = `[${new Date(message.createdAt).toISOString()}] ${formatUserRef(message.authorID)}${authorAlias ? ` alias=${authorAlias}` : ""}: ${message.content}${sanctionedSuffix}`;
      const reply = message.referencedMessageID
        ? ` [reply to ${formatUserRef(message.referencedAuthorID)}${escapeInlineValue(message.referencedAuthorUsername) ? ` alias=${escapeInlineValue(message.referencedAuthorUsername)}` : ""}: ${message.referencedContent || "(no content)"}]`
        : "";
      const attachments = formatAttachmentsSuffix(message.attachments);
      return `${base}${reply}${attachments}`;
    })
    .join("\n");
  const activeSanctionsText = await buildActiveSanctionsContext(input.guildID, input.targetUserID, input.messageCreatedAt);
  const participantAliasesText = buildParticipantAliasesText(input);
  const mentionsText = JSON.stringify((input.messageMentions ?? []).map((mention) => `<@${mention.id}>`));

  const messages = await flagChatPrompt.formatMessages({
    reporterID: input.reporterID,
    targetUserID: input.targetUserID,
    participantAliasesText,
    messageMentions: mentionsText,
    messageContent: input.messageContent,
    activeSanctionsText,
    contextText: contextText || "(vide)",
  });
  (messages[0] as SystemMessage).additional_kwargs = { cache_control: { type: "ephemeral" } };

  try {
    return await runWithTools(messages, FlagAnalysisSchema, input.guildID, input.alreadySanctionedMessageIDs);
  } catch (error) {
    console.error("[ai] analyzeFlag failed", {
      reporterID: input.reporterID,
      targetUserID: input.targetUserID,
      messageContent: input.messageContent,
      error,
    });

    return {
      isViolation: false,
      severity: "NONE",
      sanctionKind: "WARN",
      reason: "L'analyse IA du signalement a échoué. Le cas doit être revu via le flux de ticket.",
      nature: "Other",
      similarSanctionIDs: [],
      victimUserID: null,
      isTargeted: false,
      needsMoreContext: true,
    };
  }
}

const MAX_SUMMARY_ATTEMPTS = 3;

export async function summarizeReport(input: ReportAnalysisInput): Promise<SummaryResult> {
  const derivedContext = buildSummaryInputContext(input);
  const sourceReportTimezone = getSourceReportTimezone();

  const derivedContextText = derivedContext.length > 0
    ? ["Contexte derive:", ...derivedContext].join("\n")
    : "";

  const messages = await summaryChatPrompt.formatMessages({
    sourceReportTimezone,
    reporterID: input.reporterID,
    targetUserID: input.targetUserID,
    currentDate: new Date().toISOString(),
    derivedContext: derivedContextText,
    transcript: input.transcript,
  });
  (messages[0] as SystemMessage).additional_kwargs = { cache_control: { type: "ephemeral" } };

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_SUMMARY_ATTEMPTS; attempt++) {
    try {
      const raw = postProcessSummaryResult(await runWithTools(messages, SummarySchema, input.guildID, input.sanctionedMessageIDs));
      const anchorTimestamp = input.anchorTimestamp ?? Date.now();
      return await applyRecidivismEscalation(raw, input.guildID, input.targetUserID, anchorTimestamp);
    } catch (error) {
      lastError = error;
      console.error(`[ai] summarizeReport failed (attempt ${attempt}/${MAX_SUMMARY_ATTEMPTS})`, error);
      if (attempt < MAX_SUMMARY_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error("[ai] summarizeReport gave up after all attempts", lastError);
  return {
    needsFollowUp: true,
    questions: [
      "Décris plus précisément le comportement reproché en reprenant les mots exacts ou les actions visées.",
      "Quand cela s'est-il produit ? Donne une date ou une heure approximative.",
    ],
    isViolation: false,
    severity: "NONE",
    sanctionKind: "WARN",
    reason: "L'analyse IA est indisponible.",
    nature: "Other",
    similarSanctionIDs: [],
    victimUserID: null,
    isTargeted: false,
    summary: "Analyse indisponible. Le dossier doit être examiné manuellement par un modérateur.",
  };
}
