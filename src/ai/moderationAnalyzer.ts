import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { callWithFallback } from "./client";
import { FlagAnalysisResult, FlagAnalysisSchema, flagSystemPrompt, ReportAnalysisResult, ReportAnalysisSchema, reportSystemPrompt } from "./prompts";
import { duckduckgoTool } from "./tools";

export interface FlagAnalysisInput {
  reporterID: string;
  targetUserID: string;
  messageContent: string;
  contextMessages: Array<{
    authorID: string;
    authorName: string;
    content: string;
    createdAt: number;
  }>;
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
    warnSuffices: !isInsult,
    category: isInsult ? "insulte" : "autre",
    reasoning: isInsult ? "Detection heuristique d'une insulte dans le contenu signale." : "Aucune violation evidente detectee en mode degrade.",
    isBlackHumor: false,
    isInsult,
    insultTargetID: isInsult ? input.targetUserID : null,
    requiresCertification: false,
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
    .map((msg) => `[${new Date(msg.createdAt).toISOString()}] ${msg.authorName} (${msg.authorID}): ${msg.content}`)
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

export async function analyzeReport(input: ReportAnalysisInput): Promise<ReportAnalysisResult> {
  const messages: BaseMessage[] = [
    new SystemMessage(reportSystemPrompt),
    new HumanMessage(
      [
        `Reporter ID: ${input.reporterID}`,
        `Target ID: ${input.targetUserID}`,
        "Transcript du ticket:",
        input.transcript,
        "Reponds en JSON selon le schema attendu.",
      ].join("\n"),
    ),
  ];

  try {
    return await parseStructuredResult(messages, ReportAnalysisSchema);
  } catch {
    return {
      needsFollowUp: true,
      followUpQuestions: [
        "Quel message ou comportement exact reproches-tu a cet utilisateur ?",
        "Dans quel salon et a quel moment cela s'est-il produit ?",
        "As-tu des captures, liens ou temoins a ajouter ?",
      ],
      warnSuffices: true,
      qqoqccp: {
        qui: input.targetUserID,
        quoi: "",
        ou: "",
        quand: "",
        comment: "",
        combien: "",
        pourquoi: "",
      },
      severity: "LOW",
      reasoning: "Analyse IA indisponible, questions de suivi proposees en mode degrade.",
    };
  }
}
