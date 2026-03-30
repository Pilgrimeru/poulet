import { BaseMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

const openRouterApiKey = process.env["OPENROUTER_API_KEY"];
const primaryModel = process.env["AI_PRIMARY_MODEL"] ?? "minimax/minimax-m2.5:free";
const fallbackModelName = process.env["AI_FALLBACK_MODEL"] ?? "minimax/minimax-m2.5";

function createClient(model: string): ChatOpenAI | null {
  if (!openRouterApiKey) return null;
  return new ChatOpenAI({
    model,
    apiKey: openRouterApiKey,
    cache: true,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
  });
}

export const moderationLLM = createClient(primaryModel);
export const fallbackLLM = createClient(fallbackModelName);

export async function callWithFallback(messages: BaseMessage[]): Promise<string> {
  if (!moderationLLM && !fallbackLLM) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  try {
    const response = await (moderationLLM ?? fallbackLLM)!.invoke(messages);
    return typeof response.content === "string" ? response.content : JSON.stringify(response.content);
  } catch (primaryError) {
    if (!fallbackLLM || fallbackLLM === moderationLLM) {
      throw primaryError;
    }
    console.warn(
      `[ai] primary model failed (${primaryModel}), falling back to ${fallbackModelName}:`,
      primaryError,
    );
    const response = await fallbackLLM.invoke(messages);
    return typeof response.content === "string" ? response.content : JSON.stringify(response.content);
  }
}
