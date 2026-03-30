import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

const VISION_MODEL = process.env["AI_VISION_MODEL"] ?? "google/gemini-2.0-flash-exp:free";
const INTERNAL_API_BASE = process.env["API_URL"] ?? "http://localhost:3000/api";

function createVisionClient(): ChatOpenAI | null {
  const key = process.env["OPENROUTER_API_KEY"];
  if (!key) return null;
  return new ChatOpenAI({
    model: VISION_MODEL,
    apiKey: key,
    cache: true,
    configuration: { baseURL: "https://openrouter.ai/api/v1" },
  });
}

export const visionLLM = createVisionClient();

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const fullUrl = url.startsWith("/") ? `${INTERNAL_API_BASE}${url}` : url;
  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error(`OCR fetch failed for ${url}: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/png";
  const mimeType = contentType.split(";")[0].trim();
  const buffer = Buffer.from(await res.arrayBuffer());
  return { base64: buffer.toString("base64"), mimeType };
}

export async function extractTextFromImage(imageUrl: string): Promise<string> {
  if (!visionLLM) throw new Error("Vision LLM non configuré (OPENROUTER_API_KEY manquant)");

  const { base64, mimeType } = await fetchImageAsBase64(imageUrl);

  const message = new HumanMessage({
    content: [
      {
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64}` },
      },
      {
        type: "text",
        text: "Extrais tout le texte visible dans cette image, mot pour mot. Si aucun texte n'est lisible, réponds uniquement 'AUCUN_TEXTE'.",
      },
    ],
  });

  const response = await visionLLM.invoke([message]);
  return typeof response.content === "string"
    ? response.content.trim()
    : JSON.stringify(response.content);
}

export async function extractTextFromImages(
  imageUrls: string[],
): Promise<Array<{ url: string; text: string; error?: string }>> {
  return Promise.all(
    imageUrls.map(async (url) => {
      try {
        const text = await extractTextFromImage(url);
        return { url, text };
      } catch (err) {
        return { url, text: "", error: String(err) };
      }
    }),
  );
}
