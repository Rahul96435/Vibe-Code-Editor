import "server-only";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResult {
  content: string;
  model: string;
  tokens?: number;
}

export class LLMServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "LLMServiceError";
  }
}

export async function chatWithLLM(
  messages: LLMMessage[],
  options: { maxTokens: number; temperature?: number },
): Promise<LLMResult> {
  const apiKey = process.env.LLM_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim();
  const baseUrl = process.env.LLM_BASE_URL?.trim();

  if (!apiKey || !model || !baseUrl) {
    console.error("[LLM] Server configuration is incomplete", {
      apiKeyConfigured: Boolean(apiKey),
      modelConfigured: Boolean(model),
      baseUrlConfigured: Boolean(baseUrl),
    });
    throw new LLMServiceError(
      "AI service is not configured. Ask the administrator to check its server settings.",
      503,
    );
  }

  let endpoint: URL;
  try {
    const parsedBaseUrl = new URL(baseUrl);
    if (!["http:", "https:"].includes(parsedBaseUrl.protocol)) {
      throw new Error("Unsupported protocol");
    }
    const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      parsedBaseUrl.hostname,
    );
    if (
      parsedBaseUrl.protocol !== "https:" &&
      !(process.env.NODE_ENV !== "production" && isLoopback)
    ) {
      throw new Error("Provider URL must use HTTPS");
    }
    endpoint = new URL(
      "chat/completions",
      `${baseUrl.replace(/\/+$/, "")}/`,
    );
  } catch {
    console.error("[LLM] Provider URL configuration is invalid");
    throw new LLMServiceError(
      "AI service configuration is invalid. Check LLM_BASE_URL.",
      500,
    );
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options.maxTokens,
        temperature: options.temperature ?? 0.7,
        stream: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      ["AbortError", "TimeoutError"].includes(error.name);
    console.error("[LLM] Provider request failed", {
      reason: timedOut ? "timeout" : "network",
      errorName: error instanceof Error ? error.name : "unknown",
    });
    if (timedOut) {
      throw new LLMServiceError(
        "AI service timed out. Please try again.",
        504,
      );
    }
    throw new LLMServiceError(
      "AI service is temporarily unavailable. Please try again.",
      503,
    );
  }

  const requestId =
    response.headers.get("x-goog-request-id") ??
    response.headers.get("x-request-id") ??
    response.headers.get("request-id") ??
    undefined;
  if (!response.ok) {
    console.error("[LLM] Provider returned an error response", {
      status: response.status,
      requestId,
    });
  }

  if (response.status === 429) {
    throw new LLMServiceError(
      "AI service is busy right now. Please try again shortly.",
      429,
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new LLMServiceError(
      "AI service credentials were rejected. Check the server configuration.",
      502,
    );
  }
  if (!response.ok) {
    throw new LLMServiceError(
      "AI service is temporarily unavailable. Please try again.",
      response.status >= 500 ? 503 : 502,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    console.error("[LLM] Provider returned invalid JSON", {
      status: response.status,
      requestId,
    });
    throw new LLMServiceError(
      "AI service returned an invalid response. Please try again.",
      502,
    );
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    console.error("[LLM] Provider returned an unexpected response shape", {
      status: response.status,
      requestId,
    });
    throw new LLMServiceError(
      "AI service returned an invalid response. Please try again.",
      502,
    );
  }

  const result = data as {
    choices?: { message?: { content?: unknown } }[];
    model?: unknown;
    usage?: { completion_tokens?: unknown };
  };
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    console.error("[LLM] Provider returned an empty completion", {
      status: response.status,
      requestId,
    });
    throw new LLMServiceError(
      "AI service returned an empty response. Please try again.",
      502,
    );
  }

  return {
    content: content.trim(),
    model: typeof result.model === "string" ? result.model : model,
    tokens:
      typeof result.usage?.completion_tokens === "number"
        ? result.usage.completion_tokens
        : undefined,
  };
}