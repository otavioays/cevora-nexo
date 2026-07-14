export type StructuredResponseAttachment = {
  fileName: string;
  mimeType: "application/pdf" | "image/jpeg" | "image/png";
  dataBase64: string;
};

export type StructuredResponseOptions = {
  name: string;
  schema: Record<string, unknown>;
  system: string;
  user: string;
  attachment?: StructuredResponseAttachment;
};

type GeminiResponsePayload = {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  error?: {
    message?: string;
  };
};

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

export function hasGeminiEnv() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

function extractText(payload: GeminiResponsePayload) {
  return (payload.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

export async function generateGeminiStructuredResponse<T>({
  schema,
  system,
  user,
  attachment,
}: StructuredResponseOptions): Promise<{ result: T; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada no servidor.");
  }

  const model = getGeminiModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  const parts: Array<Record<string, unknown>> = [];

  if (attachment) {
    parts.push({
      inlineData: {
        mimeType: attachment.mimeType,
        data: attachment.dataBase64,
      },
    });
  }
  parts.push({ text: user });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: system }],
          },
          contents: [
            {
              role: "user",
              parts,
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 3000,
            responseMimeType: "application/json",
            responseJsonSchema: schema,
          },
        }),
        signal: controller.signal,
      },
    );

    const payload = (await response.json()) as GeminiResponsePayload;

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("O limite gratuito do Gemini foi atingido. Aguarde alguns minutos e tente novamente.");
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error("A chave do Gemini é inválida, está bloqueada ou não possui acesso ao modelo configurado.");
      }
      throw new Error(payload.error?.message || `Falha no provedor Gemini (${response.status}).`);
    }

    if (payload.promptFeedback?.blockReason) {
      throw new Error(`O Gemini bloqueou a análise: ${payload.promptFeedback.blockReason}.`);
    }

    const candidate = payload.candidates?.[0];
    if (!candidate) {
      throw new Error("O Gemini não retornou uma resposta para esta análise.");
    }

    if (candidate.finishReason && candidate.finishReason !== "STOP") {
      throw new Error(`A análise foi interrompida pelo Gemini: ${candidate.finishReason}.`);
    }

    const outputText = extractText(payload);
    if (!outputText) {
      throw new Error("O Gemini não retornou um resultado estruturado.");
    }

    return {
      result: JSON.parse(outputText) as T,
      model: `gemini:${model}`,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("A análise demorou mais que o esperado. Tente novamente.");
    }
    if (error instanceof SyntaxError) {
      throw new Error("O Gemini retornou uma estrutura inválida. Tente analisar novamente.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
