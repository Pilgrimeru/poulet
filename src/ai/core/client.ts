import { BaseMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { getLlmCache } from "./llmCache";

const openRouterApiKey = process.env["OPENROUTER_API_KEY"];
const primaryModel = process.env["AI_PRIMARY_MODEL"] ?? "minimax/minimax-m2.5:free";
const fallbackModelName = process.env["AI_FALLBACK_MODEL"] ?? "minimax/minimax-m2.5";
const llmCache = getLlmCache();

function createClient(model: string): ChatOpenAI | null {
  if (!openRouterApiKey) return null;
  return new ChatOpenAI({
    model,
    apiKey: openRouterApiKey,
    cache: llmCache,
    reasoning: {
      effort: "low",
    },
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
  });
}

export const moderationLLM = createClient(primaryModel);
export const fallbackLLM = createClient(fallbackModelName);

export const llmWithFallback = (() => {
  if (!moderationLLM) return null;
  if (!fallbackLLM || fallbackLLM === moderationLLM) return moderationLLM;
  return moderationLLM.withFallbacks([fallbackLLM]);
})();

function logMessages(label: string, messages: BaseMessage[]): void {
  console.log(`[ai] ${label}`);
  for (const msg of messages) {
    const role = msg.constructor.name.replace("Message", "").toLowerCase();
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    console.log(`  [${role}] ${content}`);
  }
}

export async function callWithFallback(messages: BaseMessage[]): Promise<string> {
  if (!llmWithFallback) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  logMessages(`→ invoke (${messages.length} messages)`, messages);

  const response = await llmWithFallback.invoke(messages);
  const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
  console.log(`[ai] ← response: ${content}`);
  return content;
}
