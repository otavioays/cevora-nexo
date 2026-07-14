import {
  generateGeminiStructuredResponse,
  type StructuredResponseOptions,
} from "@/lib/ai/gemini";

type OpenAIResponsePayload = {
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
  error?: { message?: string };
};

export const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

export function hasOpenAIEnv() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

function extractOutputText(payload: OpenAIResponsePayload) {
  if (payload.output_text) return payload.output_text;

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
      if (content.type === "refusal" && content.refusal) {
        throw new Error(`O modelo recusou a solicitação: ${content.refusal}`);
      }
    }
  }

  return null;
}

export async function generateOpenAIStructuredResponse<T>({
  name,
  schema,
  system,
  user,
}: StructuredResponseOptions): Promise<{ result: T; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada no servidor.");
  }

  const model = getOpenAIModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75_000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: system }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: user }],
          },
        ],
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name,
            strict: true,
            schema,
          },
        },
        max_output_tokens: 3000,
      }),
      signal: controller.signal,
    });

    const payload = (await response.json()) as OpenAIResponsePayload;

    if (!response.ok) {
      throw new Error(payload.error?.message || `Falha no provedor OpenAI (${response.status}).`);
    }

    if (payload.status === "incomplete") {
      throw new Error(
        `A análise foi interrompida${payload.incomplete_details?.reason ? `: ${payload.incomplete_details.reason}` : "."}`,
      );
    }

    const outputText = extractOutputText(payload);
    if (!outputText) throw new Error("A OpenAI não retornou um resultado estruturado.");

    return {
      result: JSON.parse(outputText) as T,
      model: `openai:${model}`,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("A análise demorou mais que o esperado. Tente novamente.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateStructuredResponse<T>(options: StructuredResponseOptions) {
  if (process.env.AI_PROVIDER?.trim().toLowerCase() === "openai") {
    return generateOpenAIStructuredResponse<T>(options);
  }

  return generateGeminiStructuredResponse<T>(options);
}
