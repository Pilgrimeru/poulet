import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { buildSummarySystemPrompt, flagSystemPrompt } from "./prompts";
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

  const messages: BaseMessage[] = [
    new SystemMessage({ content: flagSystemPrompt, additional_kwargs: { cache_control: { type: "ephemeral" } } }),
    new HumanMessage(
      [
        `Reporter ID: ${input.reporterID}`,
        `Reporter username: ${input.reporterUsername ?? "(unknown)"}`,
        `Reporter display name: ${input.reporterDisplayName ?? "(unknown)"}`,
        `Reported message author ID: ${input.targetUserID}`,
        `Reported message author username: ${input.targetUsername ?? "(unknown)"}`,
        `Reported message author display name: ${input.targetDisplayName ?? "(unknown)"}`,
        `Mentions detectees: ${JSON.stringify(input.messageMentions ?? [])}`,
        `Message cible: ${input.messageContent}`,
        "Contexte:",
        contextText || "(vide)",
      ].join("\n"),
    ),
  ];

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

  const messages: BaseMessage[] = [
    new SystemMessage({ content: buildSummarySystemPrompt(sourceReportTimezone), additional_kwargs: { cache_control: { type: "ephemeral" } } }),
    new HumanMessage(
      [
        `Reporter ID: ${input.reporterID}`,
        `Target ID: ${input.targetUserID}`,
        `Date actuelle (UTC): ${new Date().toISOString()}`,
        ...(derivedContext.length > 0 ? ["Contexte derive:", ...derivedContext] : []),
        "Transcript complet du ticket:",
        input.transcript,
      ].join("\n"),
    ),
  ];

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
