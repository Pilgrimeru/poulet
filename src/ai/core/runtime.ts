import { AIMessage, BaseMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createModerationTools, executeModerationToolCall } from "../tools";
import { fallbackLLM, moderationLLM } from "./client";

function getBoundLLMWithFallback<T extends Record<string, unknown>>(
  tools: ReturnType<typeof createModerationTools>,
  finalAnswerTool: ReturnType<typeof createFinalAnswerTool<T>>,
  toolChoice?: "required" | "auto",
) {
  if (!moderationLLM) throw new Error("OPENROUTER_API_KEY is not configured");
  const opts = { parallel_tool_calls: false, tool_choice: toolChoice ?? "required" } as const;
  const allTools = [...tools, finalAnswerTool];
  const primary = moderationLLM.bindTools(allTools, opts);
  if (!fallbackLLM || fallbackLLM === moderationLLM) return primary;
  const fallback = fallbackLLM.bindTools(allTools, opts);
  return primary.withFallbacks([fallback]);
}

type StructuredSchema<T> = z.ZodType<T>;

const MAX_TOOL_ITERATIONS = 4;
const FINAL_RESPONSE_TOOL_NAME = "submitFinalAnswer";

function normalizeValue(value: unknown): string {
  return (String(value) || "")
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeSeverity(value: unknown): unknown {
  const normalized = normalizeValue(value).replaceAll(/[\s-]+/g, "_");
  if (normalized === "none" || normalized === "aucune" || normalized === "nulle" || normalized === "absente" || normalized === "non_etablie" || normalized === "non_etabli") return "NONE";
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

  if ("targetID" in payload && !("victimUserID" in payload)) {
    payload["victimUserID"] = payload["targetID"];
  }

  if ("severity" in payload) payload["severity"] = normalizeSeverity(payload["severity"]);
  if ("nature" in payload) payload["nature"] = normalizeNature(payload["nature"]);

  if (
    "sanctionKind" in payload &&
    payload["sanctionKind"] !== "WARN" &&
    payload["sanctionKind"] !== "MUTE" &&
    payload["sanctionKind"] !== "BAN_PENDING"
  ) {
    payload["sanctionKind"] = "WARN";
  }

  if ("similarSanctionIDs" in payload && !Array.isArray(payload["similarSanctionIDs"])) {
    payload["similarSanctionIDs"] = [];
  }

  return payload;
}

function logMessages(label: string, messages: BaseMessage[]): void {
  console.log(`[ai] ${label}`);
  for (const msg of messages) {
    const role = msg.constructor.name.replace("Message", "").toLowerCase();
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    console.log(`  [${role}] ${content}`);
  }
}

function finalizeSchemaOutput<T extends Record<string, unknown>>(value: T): T {
  return { ...value };
}

function extractTextContent(content: AIMessage["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return part.text;
      return "";
    })
    .join("\n")
    .trim();
}

function parseStructuredContent<T extends Record<string, unknown>>(
  response: AIMessage,
  schema: StructuredSchema<T>,
): T | null {
  const raw = extractTextContent(response.content).trim();
  if (!raw) return null;

  const candidates = [raw];
  const fenced = new RegExp(/```(?:json)?\s*([\s\S]*?)```/i).exec(raw)?.[1]?.trim();
  if (fenced) candidates.push(fenced);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const normalized = normalizeStructuredPayload(parsed);
      console.log(`[ai] ← structured content: ${JSON.stringify(normalized).slice(0, 300)}`);
      return finalizeSchemaOutput(schema.parse(normalized));
    } catch {
      continue;
    }
  }

  return null;
}

function buildToolExecutor(guildID: string) {
  const cache = new Map<string, Promise<string>>();

  return async (name: string, args: unknown): Promise<string> => {
    const cacheKey = JSON.stringify({ name, args });
    const current = cache.get(cacheKey);
    if (current) return current;

    const promise = executeModerationToolCall(guildID, name, args)
      .finally(() => {
        if (cache.get(cacheKey) === promise) cache.delete(cacheKey);
      });

    cache.set(cacheKey, promise);
    return promise;
  };
}

function createFinalAnswerTool<T extends Record<string, unknown>>(schema: StructuredSchema<T>) {
  return tool(
    async (payload: T) => JSON.stringify(payload),
    {
      name: FINAL_RESPONSE_TOOL_NAME,
      description: "Call exactly once, only at the end, to return the full structured decision.",
      schema,
    },
  );
}

function getFinalAnswerOnlyChain<T extends Record<string, unknown>>(
  finalAnswerTool: ReturnType<typeof createFinalAnswerTool<T>>,
) {
  if (!moderationLLM) throw new Error("OPENROUTER_API_KEY is not configured");
  const opts = { parallel_tool_calls: false, tool_choice: "required" } as const;
  const primary = moderationLLM.bindTools([finalAnswerTool], opts);
  if (!fallbackLLM || fallbackLLM === moderationLLM) return primary;
  const fallback = fallbackLLM.bindTools([finalAnswerTool], opts);
  return primary.withFallbacks([fallback]);
}

export async function runWithTools<T extends Record<string, unknown>>(
  initialMessages: BaseMessage[],
  schema: StructuredSchema<T>,
  guildID: string,
  sanctionedMessageIDs?: Set<string>,
): Promise<T> {
  const tools = createModerationTools(guildID, sanctionedMessageIDs);
  const finalAnswerTool = createFinalAnswerTool(schema);
  const finalAnswerOnlyChain = getFinalAnswerOnlyChain(finalAnswerTool);
  const requiredChain = getBoundLLMWithFallback(tools, finalAnswerTool, "required");
  const followUpChain = getBoundLLMWithFallback(tools, finalAnswerTool, "auto");
  const executeTool = buildToolExecutor(guildID);
  let messages = [...initialMessages];

  logMessages(`→ invoke with tools (${messages.length} messages)`, messages);

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const chain = iteration === 0 ? requiredChain : followUpChain;
    const response = await chain.invoke(messages) as AIMessage;
    messages = [...messages, response];

    const toolCalls = response.tool_calls ?? [];
    console.log(`[ai] ← tool calls: ${toolCalls.map((call) => call.name).join(", ") || "(aucun)"}`);

    if (toolCalls.length === 0) {
      const parsed = parseStructuredContent(response, schema);
      if (parsed) return parsed;
      if (iteration === 0) {
        console.warn("[ai] model ignored required tool call on first pass, retrying with submitFinalAnswer-only fallback");
        const forcedFinalPrompt = new HumanMessage({
          content: [
            "Tu n'as appele aucun outil.",
            "N'appelle maintenant que submitFinalAnswer.",
            "Rends immediatement la decision finale complete au format attendu.",
            "Si les preuves sont insuffisantes, conclus isViolation=false.",
          ].join(" "),
        });
        const finalResponse = await finalAnswerOnlyChain.invoke([...messages, forcedFinalPrompt]) as AIMessage;
        const finalToolCalls = finalResponse.tool_calls ?? [];
        console.log(`[ai] ← fallback finalization tool calls: ${finalToolCalls.map((call) => call.name).join(", ") || "(aucun)"}`);

        const finalCall = finalToolCalls.find((call) => call.name === FINAL_RESPONSE_TOOL_NAME);
        if (finalCall) {
          const normalized = normalizeStructuredPayload(finalCall.args);
          console.log(`[ai] ← structured result: ${JSON.stringify(normalized).slice(0, 300)}`);
          return finalizeSchemaOutput(schema.parse(normalized));
        }

        const fallbackParsed = parseStructuredContent(finalResponse, schema);
        if (fallbackParsed) return fallbackParsed;

        throw new Error("The model did not call any tool despite tool_choice='required'");
      }
      throw new Error("The model returned neither tool calls nor a structured final answer");
    }

    const finalCall = toolCalls.find((call) => call.name === FINAL_RESPONSE_TOOL_NAME);
    if (finalCall) {
      const normalized = normalizeStructuredPayload(finalCall.args);
      console.log(`[ai] ← structured result: ${JSON.stringify(normalized).slice(0, 300)}`);
      return finalizeSchemaOutput(schema.parse(normalized));
    }

    for (const call of toolCalls) {
      let result: string;
      try {
        result = await executeTool(call.name, call.args);
      } catch (error) {
        result = `Erreur lors de l'execution de l'outil ${call.name}: ${error instanceof Error ? error.message : String(error)}`;
      }

      console.log(`[ai] ← tool result ${call.name} (${result.length} chars)`, result);
      messages = [...messages, new ToolMessage({ content: result, tool_call_id: call.id ?? call.name })];
    }
  }

  const forcedFinalPrompt = new HumanMessage({
    content: [
      "Le budget d'outils est epuise.",
      "N'appelle plus aucun outil.",
      "Rends maintenant la decision finale complete via submitFinalAnswer en t'appuyant uniquement sur les verifications deja effectuees.",
      "Si les preuves sont insuffisantes, conclus isViolation=false et explique l'insuffisance dans summary.",
    ].join(" "),
  });
  messages = [...messages, forcedFinalPrompt];
  console.log("[ai] → finalization pass with submitFinalAnswer only");

  const finalResponse = await finalAnswerOnlyChain.invoke(messages) as AIMessage;
  const finalToolCalls = finalResponse.tool_calls ?? [];
  console.log(`[ai] ← finalization tool calls: ${finalToolCalls.map((call) => call.name).join(", ") || "(aucun)"}`);

  const finalCall = finalToolCalls.find((call) => call.name === FINAL_RESPONSE_TOOL_NAME);
  if (finalCall) {
    const normalized = normalizeStructuredPayload(finalCall.args);
    console.log(`[ai] ← structured result: ${JSON.stringify(normalized).slice(0, 300)}`);
    return finalizeSchemaOutput(schema.parse(normalized));
  }

  const parsed = parseStructuredContent(finalResponse, schema);
  if (parsed) return parsed;

  throw new Error("The model did not produce a final structured answer");
}
