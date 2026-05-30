import type { RetrievalResult } from "@/lib/knowledge/retrieval";

export interface AnswerCitationDraft {
  cardId: string;
  claimText: string;
}

export interface CardBoundedAnswer {
  answerText: string;
  citations: AnswerCitationDraft[];
}

interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function getLlmConfig(): LlmConfig | null {
  const apiKey = process.env.KNOWLEDGE_LLM_API_KEY || process.env.OPENAI_API_KEY;
  const model = process.env.KNOWLEDGE_LLM_MODEL;
  const baseUrl =
    process.env.KNOWLEDGE_LLM_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  if (!apiKey || !model) return null;

  return {
    apiKey,
    model,
    baseUrl: baseUrl.replace(/\/$/, ""),
  };
}

function trimForAnswer(text: string, maxLength = 320) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength)}...`;
}

function buildDeterministicAnswer(question: string, evidence: RetrievalResult[]): CardBoundedAnswer {
  const lines = evidence.map((result, index) => {
    return `${index + 1}. ${result.card.summary}：${trimForAnswer(result.card.body)}`;
  });

  return {
    answerText: `根据知识库中可引用的卡片，针对「${question}」目前只能确认：\n${lines.join("\n")}`,
    citations: evidence.map((result) => ({
      cardId: result.card.id,
      claimText: result.card.summary,
    })),
  };
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

async function buildLlmAnswer(question: string, evidence: RetrievalResult[], config: LlmConfig) {
  const allowedCardIds = new Set(evidence.map((result) => result.card.id));
  const evidencePayload = evidence.map((result) => ({
    cardId: result.card.id,
    summary: result.card.summary,
    body: result.card.body,
    sourceDescription: result.card.sourceDescription,
    sourceType: result.card.sourceType,
    verificationStatus: result.card.verificationStatus,
  }));

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "你是 NJU 知识库的溯源问答助手。只能使用用户提供的知识卡片回答，不能使用通用知识、猜测或补全缺失信息。输出严格 JSON：{\"answer\":\"...\",\"citations\":[{\"cardId\":\"...\",\"claimText\":\"...\"}]}。每个实质结论必须有 citation。",
        },
        {
          role: "user",
          content: JSON.stringify({
            question,
            evidence: evidencePayload,
          }),
        },
      ],
    }),
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;

  const json = extractJsonObject(content);
  if (!json) return null;

  const parsed = JSON.parse(json) as {
    answer?: unknown;
    citations?: unknown;
  };

  if (typeof parsed.answer !== "string" || !Array.isArray(parsed.citations)) {
    return null;
  }

  const citations = parsed.citations
    .map((citation) => {
      if (
        !citation ||
        typeof citation !== "object" ||
        !("cardId" in citation) ||
        !("claimText" in citation)
      ) {
        return null;
      }

      const cardId = String(citation.cardId);
      const claimText = String(citation.claimText).trim();

      if (!allowedCardIds.has(cardId) || !claimText) return null;
      return { cardId, claimText };
    })
    .filter((citation): citation is AnswerCitationDraft => Boolean(citation));

  if (!parsed.answer.trim() || citations.length === 0) return null;

  return {
    answerText: parsed.answer.trim(),
    citations,
  };
}

export async function buildCardBoundedAnswer(
  question: string,
  evidence: RetrievalResult[]
): Promise<CardBoundedAnswer> {
  const fallback = buildDeterministicAnswer(question, evidence);
  const config = getLlmConfig();

  if (!config) return fallback;

  try {
    const llmAnswer = await buildLlmAnswer(question, evidence, config);
    return llmAnswer ?? fallback;
  } catch {
    return fallback;
  }
}
