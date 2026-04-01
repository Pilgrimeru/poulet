import { SystemMessage } from "@langchain/core/messages";
import { flagChatPrompt, summaryChatPrompt } from "./prompts";
import { FlagAnalysisSchema, SummarySchema } from "./schemas";
import { buildSummaryInputContext, getSourceReportTimezone, postProcessSummaryResult } from "./reportContext";
import { runWithTools } from "../core/runtime";
import type { FlagAnalysisInput, FlagAnalysisResult, ReportAnalysisInput, SummaryResult } from "./types";

export async function analyzeFlag(input: FlagAnalysisInput): Promise<FlagAnalysisResult> {
  const contextText = input.contextMessages
    .map((message) => {
      const base = `[${new Date(message.createdAt).toISOString()}] ${message.authorUsername} (${message.authorID}): ${message.content}`;
      const reply = message.referencedMessageID
        ? ` [reply to ${message.referencedAuthorUsername ?? "(unknown)"} (${message.referencedAuthorID ?? "unknown"}): ${message.referencedContent ?? "(no content)"}]`
        : "";
      const images = message.attachments?.map((attachment) => `[image: ${attachment.url}]`).join(" ") ?? "";
      return images ? `${base}${reply} ${images}` : `${base}${reply}`;
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
      reason: "L'analyse IA du signalement a echoue. Le cas doit etre revu via le flux de ticket.",
      nature: "Harassment",
      similarSanctionIDs: [],
      victimUserID: null,
      needsMoreContext: true,
      searchQuery: null,
      historyQuery: null,
    };
  }
}

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

  try {
    return postProcessSummaryResult(await runWithTools(messages, SummarySchema, input.guildID));
  } catch (error) {
    console.error("[ai] summarizeReport failed", error);
    return {
      needsFollowUp: true,
      questions: [
        "Decris plus precisement le comportement reproche avec les mots exacts ou actions visees.",
        "Quand cela s'est-il produit ? Donne une date ou une heure approximative.",
      ],
      isViolation: false,
      severity: "NONE",
      sanctionKind: "WARN",
      reason: "Analyse IA indisponible en mode degrade.",
      nature: "Harassment",
      similarSanctionIDs: [],
      victimUserID: null,
      searchQuery: null,
      historyQuery: null,
      summary: "Analyse indisponible. Le dossier doit etre examine manuellement par un moderateur.",
    };
  }
}
