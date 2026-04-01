import { AIMessage, BaseMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createModerationTools, executeModerationToolCall } from "../tools";
import { fallbackLLM, moderationLLM } from "./client";

type StructuredSchema<T> = z.ZodType<T>;

const MAX_TOOL_ITERATIONS = 4;
const FINAL_RESPONSE_TOOL_NAME = "submitFinalAnswer";

function getCandidateLLMs() {
  const candidates = [moderationLLM, fallbackLLM].filter((llm): llm is NonNullable<typeof moderationLLM> => Boolean(llm));
  if (candidates.length === 0) throw new Error("OPENROUTER_API_KEY is not configured");
  return candidates.filter((llm, index, arr) => arr.indexOf(llm) === index);
}

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

  if ("searchQuery" in payload && payload["searchQuery"] !== null && typeof payload["searchQuery"] !== "string") {
    payload["searchQuery"] = null;
  }

  if ("historyQuery" in payload && payload["historyQuery"] !== null && typeof payload["historyQuery"] !== "object") {
    payload["historyQuery"] = null;
  }

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
  const output = { ...value } as Record<string, unknown>;
  if ("historyQuery" in output) output["historyQuery"] = null;
  if ("searchQuery" in output) output["searchQuery"] = null;
  return output as T;
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
      description: "Appelle cet outil exactement une fois quand tu as suffisamment d'informations. N'appelle cet outil qu'en toute fin pour renvoyer la decision structuree complete.",
      schema,
    },
  );
}

function getToolRunnable<T extends Record<string, unknown>>(
  llm: NonNullable<typeof moderationLLM>,
  tools: ReturnType<typeof createModerationTools>,
  finalAnswerTool: ReturnType<typeof createFinalAnswerTool<T>>,
) {
  return llm.bindTools([...tools, finalAnswerTool], {
    parallel_tool_calls: false,
    tool_choice: "required",
  });
}

export async function runWithTools<T extends Record<string, unknown>>(
  initialMessages: BaseMessage[],
  schema: StructuredSchema<T>,
  guildID: string,
): Promise<T> {
  const tools = createModerationTools(guildID);
  const finalAnswerTool = createFinalAnswerTool(schema);
  const executeTool = buildToolExecutor(guildID);
  let messages = [...initialMessages];
  let lastError: unknown;

  logMessages(`→ invoke with tools (${messages.length} messages)`, messages);

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    for (const [index, llm] of getCandidateLLMs().entries()) {
      try {
        const response = await getToolRunnable(llm, tools, finalAnswerTool).invoke(messages) as AIMessage;
        messages = [...messages, response];

        const toolCalls = response.tool_calls ?? [];
        console.log(`[ai] ← tool calls${index === 0 ? "" : " (fallback)"}: ${toolCalls.map((call) => call.name).join(", ") || "(aucun)"}`);

        if (toolCalls.length === 0) {
          throw new Error("The model did not call any tool despite tool_choice='required'");
        }

        const finalCall = toolCalls.find((call) => call.name === FINAL_RESPONSE_TOOL_NAME);
        if (finalCall) {
          const normalized = normalizeStructuredPayload(finalCall.args);
          console.log(`[ai] ← structured result${index === 0 ? "" : " (fallback)"}: ${JSON.stringify(normalized).slice(0, 300)}`);
          return finalizeSchemaOutput(schema.parse(normalized));
        }

        for (const call of toolCalls) {
          console.log("[ai] tool call", {
            name: call.name,
            args: call.args,
            id: call.id,
          });

          let result: string;
          try {
            result = await executeTool(call.name, call.args);
          } catch (error) {
            result = `Erreur lors de l'execution de l'outil ${call.name}: ${error instanceof Error ? error.message : String(error)}`;
          }

          console.log(`[ai] ← tool result ${call.name} (${result.length} chars)`, result);
          messages = [...messages, new ToolMessage({ content: result, tool_call_id: call.id ?? call.name })];
        }

        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        console.warn(`[ai] tool loop failed on model #${index + 1}`, error);
      }
    }
  }

  throw lastError ?? new Error("The model did not produce a final structured answer");
}
