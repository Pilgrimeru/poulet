import { formatAttachmentsSuffix, formatReplySuffix } from "@/discord/components/moderation/messageFormatting";
import { SystemMessage } from "@langchain/core/messages";
import { sanctionApiService, type SanctionSeverity } from "@/api/sanctionApiService";
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
      const base = `[${new Date(message.createdAt).toISOString()}] ${message.authorUsername} (${message.authorID}): ${message.content}`;
      const reply = formatReplySuffix({
        referencedMessageID: message.referencedMessageID,
        referencedAuthorID: message.referencedAuthorID,
        referencedAuthorUsername: message.referencedAuthorUsername,
        referencedContent: message.referencedContent,
      });
      const attachments = formatAttachmentsSuffix(message.attachments);
      return `${base}${reply}${attachments}`;
    })
    .join("\n");

  const messages = await flagChatPrompt.formatMessages({
    reporterID: input.reporterID,
    reporterUsername: input.reporterUsername ?? "(unknown)",
    reporterDisplayName: input.reporterDisplayName ?? "(unknown)",
    targetUserID: input.targetUserID,
    targetUsername: input.targetUsername ?? "(unknown)",
    targetDisplayName: input.targetDisplayName ?? "(unknown)",
    messageMentions: JSON.stringify(input.messageMentions ?? []),
    messageContent: input.messageContent,
    contextText: contextText || "(vide)",
  });
  (messages[0] as SystemMessage).additional_kwargs = { cache_control: { type: "ephemeral" } };

  try {
    return await runWithTools(messages, FlagAnalysisSchema, input.guildID);
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
      searchQuery: null,
      historyQuery: null,
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
      const raw = postProcessSummaryResult(await runWithTools(messages, SummarySchema, input.guildID));
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
    searchQuery: null,
    historyQuery: null,
    summary: "Analyse indisponible. Le dossier doit être examiné manuellement par un modérateur.",
  };
}
