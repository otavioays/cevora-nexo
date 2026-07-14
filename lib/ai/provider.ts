import {
  generateGeminiStructuredResponse,
  hasGeminiEnv,
  type StructuredResponseOptions,
} from "@/lib/ai/gemini";
import { generateStructuredResponse as generateOpenAIStructuredResponse, hasOpenAIEnv } from "@/lib/ai/openai";

export type AiProvider = "gemini" | "openai";

export function getAiProvider(): AiProvider {
  return process.env.AI_PROVIDER?.trim().toLowerCase() === "openai" ? "openai" : "gemini";
}

export function hasAiEnv() {
  return getAiProvider() === "openai" ? hasOpenAIEnv() : hasGeminiEnv();
}

export async function generateStructuredResponse<T>(options: StructuredResponseOptions) {
  if (getAiProvider() === "openai") {
    return generateOpenAIStructuredResponse<T>(options);
  }

  return generateGeminiStructuredResponse<T>(options);
}
