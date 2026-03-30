import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
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

export interface ContextMessage {
  id: string;
  authorID: string;
  authorUsername: string;
  authorAvatarURL: string;
  content: string;
  createdAt: number;
  referencedMessageID: string | null;
}

export interface FlagAnalysisInput {
  reporterID: string;
  targetUserID: string;
  messageContent: string;
  contextMessages: ContextMessage[];
}

export interface ReportAnalysisInput {
  reporterID: string;
  targetUserID: string;
  transcript: string;
}

function extractJSONObject(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Invalid JSON response: ${raw}`);
  }
  return raw.slice(start, end + 1);
}

function heuristicFlagAnalysis(input: FlagAnalysisInput): FlagAnalysisResult {
  const text = `${input.messageContent}\n${input.contextMessages.map((msg) => msg.content).join("\n")}`.toLowerCase();
  const insultWords = ["idiot", "connard", "pute", "fdp", "debile", "abruti", "salope", "encule"];
  const isInsult = insultWords.some((word) => text.includes(word));
  return {
    isViolation: isInsult,
    severity: isInsult ? "MEDIUM" : "LOW",
    reason: isInsult ? "Detection heuristique d'une insulte dans le contenu signale." : "Aucune violation evidente detectee en mode degrade.",
    nature: isInsult ? "Harassment" : "Spam",
    targetID: isInsult ? input.targetUserID : null,
    needsMoreContext: !isInsult && input.contextMessages.length < 3,
    searchQuery: null,
  };
}

async function parseStructuredResult<T>(messages: BaseMessage[], schema: { parse: (value: unknown) => T }): Promise<T> {
  const raw = await callWithFallback(messages);
  return schema.parse(JSON.parse(extractJSONObject(raw)));
}

export async function analyzeFlag(input: FlagAnalysisInput): Promise<FlagAnalysisResult> {
  const contextText = input.contextMessages
    .map((msg) => `[${new Date(msg.createdAt).toISOString()}] ${msg.authorUsername} (${msg.authorID}): ${msg.content}`)
    .join("\n");

  const messages: BaseMessage[] = [
    new SystemMessage(flagSystemPrompt),
    new HumanMessage(
      [
        `Reporter ID: ${input.reporterID}`,
        `Target ID: ${input.targetUserID}`,
        `Message cible: ${input.messageContent}`,
        "Contexte:",
        contextText || "(vide)",
        "Reponds en JSON selon le schema attendu.",
      ].join("\n"),
    ),
  ];

  try {
    let result = await parseStructuredResult(messages, FlagAnalysisSchema);
    if (result.searchQuery) {
      const searchResult = await duckduckgoTool.invoke(result.searchQuery);
      const followUpMessages: BaseMessage[] = [
        ...messages,
        new HumanMessage(`Resultats DuckDuckGo:\n${typeof searchResult === "string" ? searchResult : JSON.stringify(searchResult)}`),
      ];
      result = await parseStructuredResult(followUpMessages, FlagAnalysisSchema);
    }
    return result;
  } catch {
    return heuristicFlagAnalysis(input);
  }
}

export async function askReportQuestions(input: ReportAnalysisInput): Promise<QuestionResult> {
  const messages: BaseMessage[] = [
    new SystemMessage(questionSystemPrompt),
    new HumanMessage(
      [
        `Reporter ID: ${input.reporterID}`,
        `Target ID: ${input.targetUserID}`,
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
    new SystemMessage(summarySystemPrompt),
    new HumanMessage(
      [
        `Reporter ID: ${input.reporterID}`,
        `Target ID: ${input.targetUserID}`,
        "Transcript complet du ticket:",
        input.transcript,
        "Reponds en JSON selon le schema attendu.",
      ].join("\n"),
    ),
  ];

  try {
    let result = await parseStructuredResult(messages, SummarySchema);
    if (result.searchQuery) {
      const searchResult = await duckduckgoTool.invoke(result.searchQuery);
      const followUpMessages: BaseMessage[] = [
        ...messages,
        new HumanMessage(`Resultats DuckDuckGo:\n${typeof searchResult === "string" ? searchResult : JSON.stringify(searchResult)}`),
      ];
      result = await parseStructuredResult(followUpMessages, SummarySchema);
    }
    return result;
  } catch {
    return {
      isViolation: false,
      severity: "LOW",
      reason: "Analyse IA indisponible en mode degrade.",
      nature: "Harassment",
      targetID: input.targetUserID,
      searchQuery: null,
      summary: "Analyse indisponible. Le dossier doit etre examine manuellement par un moderateur.",
    };
  }
}
