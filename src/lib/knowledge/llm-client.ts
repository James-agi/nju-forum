export class LlmError extends Error {
  constructor(
    public code: "TIMEOUT" | "HTTP_ERROR" | "PARSE_ERROR" | "NO_CONFIG",
    message?: string,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

interface ChatConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface EmbeddingConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function sanitizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

export function getChatConfig(): ChatConfig | null {
  const apiKey = process.env.KNOWLEDGE_LLM_API_KEY || process.env.OPENAI_API_KEY;
  const model = process.env.KNOWLEDGE_LLM_MODEL;
  const baseUrl = sanitizeBaseUrl(
    process.env.KNOWLEDGE_LLM_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  );
  if (!apiKey || !model) return null;
  return { apiKey, model, baseUrl };
}

export function getAnswerConfig(): ChatConfig | null {
  const apiKey =
    process.env.KNOWLEDGE_ANSWER_API_KEY ||
    process.env.KNOWLEDGE_LLM_API_KEY ||
    process.env.OPENAI_API_KEY;
  const model = process.env.KNOWLEDGE_ANSWER_MODEL || process.env.KNOWLEDGE_LLM_MODEL;
  const baseUrl = sanitizeBaseUrl(
    process.env.KNOWLEDGE_ANSWER_BASE_URL ||
      process.env.KNOWLEDGE_LLM_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      "https://api.openai.com/v1",
  );
  if (!apiKey || !model) return null;
  return { apiKey, model, baseUrl };
}

export function getEmbeddingConfig(): EmbeddingConfig | null {
  const apiKey =
    process.env.KNOWLEDGE_EMBEDDING_API_KEY ||
    process.env.KNOWLEDGE_LLM_API_KEY ||
    process.env.OPENAI_API_KEY;
  const model = process.env.KNOWLEDGE_EMBEDDING_MODEL || "bge-m3";
  const baseUrl = sanitizeBaseUrl(
    process.env.KNOWLEDGE_EMBEDDING_BASE_URL ||
    process.env.KNOWLEDGE_LLM_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    "https://api.openai.com/v1",
  );
  if (!apiKey) return null;
  return { apiKey, model, baseUrl };
}

export interface ChatCompletionParams {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

async function runChatCompletion(params: ChatCompletionParams, config: ChatConfig | null): Promise<string> {
  if (!config) throw new LlmError("NO_CONFIG");
  const { messages, maxTokens = 1024, temperature = 0.1, timeoutMs = 15000 } = params;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature,
        max_tokens: maxTokens,
        messages,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new LlmError("HTTP_ERROR", `HTTP ${response.status}`);
    }

    let payload: { choices?: Array<{ message?: { content?: string } }> };
    try {
      payload = await response.json();
    } catch {
      throw new LlmError("PARSE_ERROR", "Failed to parse response body");
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new LlmError("PARSE_ERROR", "Empty content in response");
    }

    return content;
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new LlmError("TIMEOUT");
    }
    throw new LlmError("HTTP_ERROR", (err as Error).message);
  } finally {
    clearTimeout(timeout);
  }
}

export async function chatCompletion(params: ChatCompletionParams): Promise<string> {
  return runChatCompletion(params, getChatConfig());
}

export async function answerCompletion(params: ChatCompletionParams): Promise<string> {
  return runChatCompletion(params, getAnswerConfig());
}

export interface EmbeddingParams {
  input: string;
  timeoutMs?: number;
}

export async function createEmbedding(params: EmbeddingParams): Promise<number[]> {
  const config = getEmbeddingConfig();
  if (!config) throw new LlmError("NO_CONFIG");

  const { input, timeoutMs = 5000 } = params;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        input,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new LlmError("HTTP_ERROR", `HTTP ${response.status}`);
    }

    let payload: { data?: Array<{ embedding?: number[] }> };
    try {
      payload = await response.json();
    } catch {
      throw new LlmError("PARSE_ERROR", "Failed to parse embedding response");
    }

    const vector = payload.data?.[0]?.embedding;
    if (!vector) {
      throw new LlmError("PARSE_ERROR", "No embedding in response");
    }

    return vector;
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new LlmError("TIMEOUT");
    }
    throw new LlmError("HTTP_ERROR", (err as Error).message);
  } finally {
    clearTimeout(timeout);
  }
}
