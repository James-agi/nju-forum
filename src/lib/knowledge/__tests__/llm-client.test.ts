import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAnswerConfig, getChatConfig, getEmbeddingConfig, LlmError } from "../llm-client";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getChatConfig", () => {
  it("returns config when KNOWLEDGE_LLM_* vars are set", () => {
    process.env.KNOWLEDGE_LLM_API_KEY = "sk-test";
    process.env.KNOWLEDGE_LLM_MODEL = "gpt-4";
    process.env.KNOWLEDGE_LLM_BASE_URL = "https://custom.example.com/v1";

    const config = getChatConfig();
    expect(config).not.toBeNull();
    expect(config!.apiKey).toBe("sk-test");
    expect(config!.model).toBe("gpt-4");
    expect(config!.baseUrl).toBe("https://custom.example.com/v1");
  });

  it("falls back to OPENAI_* vars", () => {
    process.env.OPENAI_API_KEY = "sk-openai";
    process.env.KNOWLEDGE_LLM_MODEL = "gpt-4";
    delete process.env.KNOWLEDGE_LLM_API_KEY;

    const config = getChatConfig();
    expect(config).not.toBeNull();
    expect(config!.apiKey).toBe("sk-openai");
  });

  it("uses default baseUrl when none provided", () => {
    process.env.KNOWLEDGE_LLM_API_KEY = "sk-test";
    process.env.KNOWLEDGE_LLM_MODEL = "gpt-4";
    delete process.env.KNOWLEDGE_LLM_BASE_URL;
    delete process.env.OPENAI_BASE_URL;

    const config = getChatConfig();
    expect(config!.baseUrl).toBe("https://api.openai.com/v1");
  });

  it("returns null when apiKey is missing", () => {
    delete process.env.KNOWLEDGE_LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.KNOWLEDGE_LLM_MODEL = "gpt-4";

    expect(getChatConfig()).toBeNull();
  });

  it("returns null when model is missing", () => {
    process.env.KNOWLEDGE_LLM_API_KEY = "sk-test";
    delete process.env.KNOWLEDGE_LLM_MODEL;

    expect(getChatConfig()).toBeNull();
  });
});

describe("getAnswerConfig", () => {
  it("prioritizes KNOWLEDGE_ANSWER_* vars for final answers", () => {
    process.env.KNOWLEDGE_ANSWER_API_KEY = "sk-answer";
    process.env.KNOWLEDGE_ANSWER_MODEL = "gpt-5.5";
    process.env.KNOWLEDGE_ANSWER_BASE_URL = "https://answer.example.com/v1";
    process.env.KNOWLEDGE_LLM_API_KEY = "sk-llm";
    process.env.KNOWLEDGE_LLM_MODEL = "cheap-model";
    process.env.KNOWLEDGE_LLM_BASE_URL = "https://cheap.example.com/v1";

    const config = getAnswerConfig();
    expect(config).not.toBeNull();
    expect(config!.apiKey).toBe("sk-answer");
    expect(config!.model).toBe("gpt-5.5");
    expect(config!.baseUrl).toBe("https://answer.example.com/v1");
  });

  it("falls back to KNOWLEDGE_LLM_* vars when answer vars are not set", () => {
    process.env.KNOWLEDGE_LLM_API_KEY = "sk-llm";
    process.env.KNOWLEDGE_LLM_MODEL = "cheap-model";
    process.env.KNOWLEDGE_LLM_BASE_URL = "https://cheap.example.com/v1";
    delete process.env.KNOWLEDGE_ANSWER_API_KEY;
    delete process.env.KNOWLEDGE_ANSWER_MODEL;
    delete process.env.KNOWLEDGE_ANSWER_BASE_URL;

    const config = getAnswerConfig();
    expect(config).not.toBeNull();
    expect(config!.apiKey).toBe("sk-llm");
    expect(config!.model).toBe("cheap-model");
    expect(config!.baseUrl).toBe("https://cheap.example.com/v1");
  });
});

describe("getEmbeddingConfig", () => {
  it("prioritizes KNOWLEDGE_EMBEDDING_* over KNOWLEDGE_LLM_*", () => {
    process.env.KNOWLEDGE_EMBEDDING_API_KEY = "sk-embed";
    process.env.KNOWLEDGE_EMBEDDING_MODEL = "text-embedding-3";
    process.env.KNOWLEDGE_LLM_API_KEY = "sk-llm"; // should not be used

    const config = getEmbeddingConfig();
    expect(config!.apiKey).toBe("sk-embed");
    expect(config!.model).toBe("text-embedding-3");
  });

  it("falls back to KNOWLEDGE_LLM_API_KEY and default model", () => {
    process.env.KNOWLEDGE_LLM_API_KEY = "sk-llm";
    delete process.env.KNOWLEDGE_EMBEDDING_API_KEY;
    delete process.env.KNOWLEDGE_EMBEDDING_MODEL;

    const config = getEmbeddingConfig();
    expect(config!.apiKey).toBe("sk-llm");
    expect(config!.model).toBe("bge-m3");
  });

  it("returns null when all apiKey sources are empty", () => {
    delete process.env.KNOWLEDGE_EMBEDDING_API_KEY;
    delete process.env.KNOWLEDGE_LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;

    expect(getEmbeddingConfig()).toBeNull();
  });
});

describe("LlmError", () => {
  it("creates error with correct name and code", () => {
    const err = new LlmError("TIMEOUT", "request timed out");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("LlmError");
    expect(err.code).toBe("TIMEOUT");
    expect(err.message).toBe("request timed out");
  });
});
