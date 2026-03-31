import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ContextMessage } from "@/api/flaggedMessageApiService";
import { messageSnapshotService } from "@/api/messageSnapshotService";
import { callWithFallback } from "./client";
import {
  FlagAnalysisResult,
  FlagAnalysisSchema,
  flagSystemPrompt,
  QuestionResult,
  QuestionSchema,
  questionSystemPrompt,
  SummaryResult,
  SummarySchema,
  summarySystemPrompt,
} from "./prompts";
import { duckduckgoTool } from "./tools";

export interface FlagAnalysisInput {
  guildID: string;
  reporterID: string;
  reporterUsername?: string | null;
  reporterDisplayName?: string | null;
  targetUserID: string;
  targetUsername?: string | null;
  targetDisplayName?: string | null;
  priorSanctions?: Array<{
    id: string;
    type: string;
    severity: string;
    nature: string;
    reason: string;
    state: string;
    createdAt: number;
  }>;
  messageMentions?: Array<{ id: string; username?: string | null; displayName?: string | null }>;
  messageContent: string;
  contextMessages: ContextMessage[];
}

export interface ReportAnalysisInput {
  guildID: string;
  reporterID: string;
  targetUserID: string;
  transcript: string;
  priorSanctions?: Array<{
    id: string;
    type: string;
    severity: string;
    nature: string;
    reason: string;
    state: string;
    createdAt: number;
  }>;
}

function normalizeValue(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeSeverity(value: unknown): unknown {
  const normalized = normalizeValue(value).replaceAll(/[\s-]+/g, "_");
  if (normalized === "low" || normalized === "faible") return "LOW";
  if (normalized === "medium" || normalized === "moyen" || normalized === "modere" || normalized === "moderee") return "MEDIUM";
  if (normalized === "high" || normalized === "grave" || normalized === "eleve" || normalized === "elevee") return "HIGH";
  if (normalized === "unforgivable" || normalized === "impardonnable") return "UNFORGIVABLE";
  return value;
}

function normalizeNature(value: unknown): unknown {
  const normalized = normalizeValue(value).replaceAll(/[\s_-]+/g, "");
  if (["extremism", "extremisme"].includes(normalized)) return "Extremism";
  if (["violence"].includes(normalized)) return "Violence";
  if (["hate", "haine"].includes(normalized)) return "Hate";
  if (["harassment", "harcelement", "harcelementcible", "insulte", "injure", "agressionverbale"].includes(normalized)) return "Harassment";
  if (["spam", "flood"].includes(normalized)) return "Spam";
  if (["manipulation", "negationnisme", "doxxing", "contournement"].includes(normalized)) return "Manipulation";
  if (["recidivism", "recidive"].includes(normalized)) return "Recidivism";
  if (["other", "autre", "unknown", "misc", "miscellaneous"].includes(normalized)) return "Other";
  return value;
}

function normalizeStructuredPayload(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const payload = { ...(value as Record<string, unknown>) };
  if ("severity" in payload) payload["severity"] = normalizeSeverity(payload["severity"]);
  if ("nature" in payload) payload["nature"] = normalizeNature(payload["nature"]);
  if (
    !("sanctionKind" in payload) ||
    (payload["sanctionKind"] !== "WARN" &&
      payload["sanctionKind"] !== "MUTE" &&
      payload["sanctionKind"] !== "BAN_PENDING")
  ) {
    payload["sanctionKind"] = "WARN";
  }
  if (!Array.isArray(payload["similarSanctionIDs"])) payload["similarSanctionIDs"] = [];
  return payload;
}

function extractJSONObject(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Invalid JSON response: ${raw}`);
  }
  return raw.slice(start, end + 1);
}

const MAX_TOOL_ITERATIONS = 3;

async function runToolLoop<T extends {
  searchQuery: string | null;
  historyQuery: { userID: string; startDate: number | null; endDate: number | null; onlyDeleted: boolean; channelID: string | null; limit: number } | null;
}>(
  initialMessages: BaseMessage[],
  schema: { parse: (value: unknown) => T },
  guildID: string,
): Promise<T> {
  let messages = [...initialMessages];
  let result = await parseStructuredResult(messages, schema);
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    if (result.searchQuery) {
      const searchResult = await duckduckgoTool.invoke(result.searchQuery);
      messages = [
        ...messages,
        new HumanMessage(
          `[Outil: DuckDuckGo — requete: "${result.searchQuery}"]\n` +
          (typeof searchResult === "string" ? searchResult : JSON.stringify(searchResult)),
        ),
      ];
    } else if (result.historyQuery) {
      const q = result.historyQuery;
      const history = await messageSnapshotService.getUserMessages(guildID, q.userID, {
        startDate: q.startDate ?? undefined,
        endDate: q.endDate ?? undefined,
        onlyDeleted: q.onlyDeleted,
        channelID: q.channelID ?? undefined,
        limit: q.limit,
      });
      const formatted = history.length === 0
        ? "Aucun message trouve."
        : history.map((m) =>
            `[${new Date(m.createdAt).toISOString()}] #${m.channelID} ${m.authorUsername}: ${m.content}` +
            (m.isDeleted ? " [SUPPRIME]" : ""),
          ).join("\n");
      messages = [
        ...messages,
        new HumanMessage(
          `[Outil: Historique utilisateur — userID: ${q.userID}, ${history.length} messages]\n${formatted}`,
        ),
      ];
    } else {
      break;
    }

    iterations++;
    result = await parseStructuredResult(messages, schema);
  }

  return result;
}

async function parseStructuredResult<T>(messages: BaseMessage[], schema: { parse: (value: unknown) => T }): Promise<T> {
  const raw = await callWithFallback(messages);
  const parsed = JSON.parse(extractJSONObject(raw));
  const normalized = normalizeStructuredPayload(parsed);

  try {
    return schema.parse(normalized);
  } catch (error) {
    const repairMessages: BaseMessage[] = [
      ...messages,
      new HumanMessage(
        [
          "Ta réponse JSON précédente est invalide pour le schéma attendu.",
          `Erreur de validation: ${error instanceof Error ? error.message : String(error)}`,
          `JSON précédent: ${JSON.stringify(normalized)}`,
          "Régénère maintenant un JSON complet et valide.",
          "Tous les champs requis doivent être présents, notamment reason, severity, nature, isViolation, targetID, needsMoreContext, searchQuery.",
          "Ne réponds qu'avec un objet JSON valide.",
        ].join("\n"),
      ),
    ];

    const repairedRaw = await callWithFallback(repairMessages);
    const repairedParsed = JSON.parse(extractJSONObject(repairedRaw));
    return schema.parse(normalizeStructuredPayload(repairedParsed));
  }
}

export async function analyzeFlag(input: FlagAnalysisInput): Promise<FlagAnalysisResult> {
  const contextText = input.contextMessages
    .map((msg) => {
      const base = `[${new Date(msg.createdAt).toISOString()}] ${msg.authorUsername} (${msg.authorID}): ${msg.content}`;
      const imgs = msg.attachments?.map((a) => `[image: ${a.url}]`).join(" ") ?? "";
      return imgs ? `${base} ${imgs}` : base;
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
        `Sanctions precedentes pertinentes: ${JSON.stringify(input.priorSanctions ?? [])}`,
        `Mentions detectees: ${JSON.stringify(input.messageMentions ?? [])}`,
        `Message cible: ${input.messageContent}`,
        "Contexte:",
        contextText || "(vide)",
        "Reponds en JSON selon le schema attendu.",
      ].join("\n"),
    ),
  ];

  try {
    return await runToolLoop(messages, FlagAnalysisSchema, input.guildID);
  } catch (error) {
    console.error("[ai] analyzeFlag failed", {
      reporterID: input.reporterID,
      targetUserID: input.targetUserID,
      messageContent: input.messageContent,
      error,
    });
    return {
      isViolation: false,
      severity: "LOW",
      sanctionKind: "WARN",
      reason: "L'analyse IA du signalement a échoué. Le cas doit être revu via le flux de ticket.",
      nature: "Harassment",
      similarSanctionIDs: [],
      targetID: null,
      needsMoreContext: true,
      searchQuery: null,
      historyQuery: null,
    };
  }
}

export async function askReportQuestions(input: ReportAnalysisInput): Promise<QuestionResult> {
  const messages: BaseMessage[] = [
    new SystemMessage(questionSystemPrompt),
    new HumanMessage(
      [
        `Reporter ID: ${input.reporterID}`,
        `Target ID: ${input.targetUserID}`,
        `Sanctions precedentes pertinentes: ${JSON.stringify(input.priorSanctions ?? [])}`,
        "Contenu du dossier:",
        input.transcript,
        "Reponds en JSON selon le schema attendu.",
      ].join("\n"),
    ),
  ];

  try {
    return await parseStructuredResult(messages, QuestionSchema);
  } catch {
    return {
      needsFollowUp: true,
      questions: [
        "Quel message ou comportement exact reproches-tu a cet utilisateur ?",
        "Dans quel salon et a quel moment cela s'est-il produit ?",
        "As-tu des captures, liens ou temoins a ajouter ?",
      ],
    };
  }
}

export async function summarizeReport(input: ReportAnalysisInput): Promise<SummaryResult> {
  const messages: BaseMessage[] = [
    new SystemMessage({ content: summarySystemPrompt, additional_kwargs: { cache_control: { type: "ephemeral" } } }),
    new HumanMessage(
      [
        `Reporter ID: ${input.reporterID}`,
        `Target ID: ${input.targetUserID}`,
        `Sanctions precedentes pertinentes: ${JSON.stringify(input.priorSanctions ?? [])}`,
        "Transcript complet du ticket:",
        input.transcript,
        "Reponds en JSON selon le schema attendu.",
      ].join("\n"),
    ),
  ];

  try {
    return await runToolLoop(messages, SummarySchema, input.guildID);
  } catch {
    return {
      isViolation: false,
      severity: "LOW",
      sanctionKind: "WARN",
      reason: "Analyse IA indisponible en mode degrade.",
      nature: "Harassment",
      similarSanctionIDs: [],
      targetID: input.targetUserID,
      searchQuery: null,
      historyQuery: null,
      summary: "Analyse indisponible. Le dossier doit etre examine manuellement par un moderateur.",
    };
  }
}
