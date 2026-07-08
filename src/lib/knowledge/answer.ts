import type { RetrievalResult } from "@/lib/knowledge/retrieval";
import { chatCompletion, LlmError } from "@/lib/knowledge/llm-client";
import { LLM_ANSWER_TIMEOUT, LLM_MAX_TOKENS, LLM_TEMPERATURE } from "@/lib/knowledge/config";

export interface AnswerCitationDraft {
  cardId: string;
  claimText: string;
}

export type AnswerMode = "LLM" | "FALLBACK";
export type FallbackReason = "NO_CONFIG" | "HTTP_ERROR" | "TIMEOUT" | "PARSE_ERROR" | "EMPTY_RESULT" | "EXCEPTION";

export interface CardBoundedAnswer {
  answerText: string;
  citations: AnswerCitationDraft[];
  answerMode: AnswerMode;
  fallbackReason?: FallbackReason;
}

const SYSTEM_PROMPT =
  "你是 NJU 知识库的溯源问答助手。你的角色仅限于基于提供的知识卡片回答问题。" +
  "绝对不能使用通用知识、猜测或补全缺失信息。如果卡片信息不足，如实说明。" +
  "如果问题询问实时状态、当天情况、年度变化、具体余量或精确数值，而卡片只提供一般规则/路径，只能回答一般信息和查询路径，并明确说明不能确认实时或个人化结果。" +
  "输出严格 JSON：{\"answer\":\"...\",\"citations\":[{\"cardId\":\"...\",\"claimText\":\"...\"}]}。" +
  "每个实质结论必须有 citation。" +
  "如果用户问题依赖前文（如代词指代、省略主语），结合 conversationHistory 理解完整意图。";

const LIMITED_ANSWER_PATTERNS = [
  /今天|明天|今晚|现在|当前|实时|最新|今年|本学期|下学期/,
  /具体|精确|最低|名额|余量|余票|还有没有|有没有票|有没有号/,
  /几点|开门|关门|营业|开放时间|关闭时间/,
  /余额|多少钱|价格|哪位老师/,
];

const LIMITED_ANSWER_NOTE =
  "注意：这个问题包含实时、年度变化或精确细节。知识库只能提供已有卡片里的通用信息和查询路径，不能确认实时状态、个人数据或当年最终结果。";

function needsLimitedAnswerNote(question: string) {
  return LIMITED_ANSWER_PATTERNS.some((pattern) => pattern.test(question));
}

function appendLimitedAnswerNote(question: string, answer: string) {
  if (!needsLimitedAnswerNote(question)) return answer;
  if (answer.includes("知识库只能提供已有卡片里的通用信息和查询路径")) return answer;
  return `${answer}\n\n${LIMITED_ANSWER_NOTE}`;
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
    answerText: appendLimitedAnswerNote(
      question,
      `根据知识库中可引用的卡片，针对「${question}」目前只能确认：\n${lines.join("\n")}`,
    ),
    citations: evidence.map((result) => ({
      cardId: result.card.id,
      claimText: result.card.summary,
    })),
    answerMode: "FALLBACK",
  };
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

export async function buildCardBoundedAnswer(
  question: string,
  evidence: RetrievalResult[],
  conversationHistory: Array<{ question: string; answer: string }> = [],
): Promise<CardBoundedAnswer> {
  const fallback = buildDeterministicAnswer(question, evidence);

  let llmContent: string;
  try {
    const evidencePayload = evidence.map((result) => ({
      cardId: result.card.id,
      summary: result.card.summary,
      body: result.card.body,
      sourceDescription: result.card.sourceDescription,
      sourceType: result.card.sourceType,
      verificationStatus: result.card.verificationStatus,
    }));

    const userContent: Record<string, unknown> = {
      question,
      evidence: evidencePayload,
    };
    if (conversationHistory.length > 0) {
      userContent.conversationHistory = conversationHistory;
    }

    llmContent = await chatCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify(userContent),
        },
      ],
      maxTokens: LLM_MAX_TOKENS,
      temperature: LLM_TEMPERATURE,
      timeoutMs: LLM_ANSWER_TIMEOUT,
    });
  } catch (err) {
    if (err instanceof LlmError) {
      fallback.fallbackReason = err.code as FallbackReason;
    } else {
      fallback.fallbackReason = "EXCEPTION";
    }
    return fallback;
  }

  const json = extractJsonObject(llmContent);
  if (!json) {
    fallback.fallbackReason = "PARSE_ERROR";
    return fallback;
  }

  let parsed: { answer?: unknown; citations?: unknown };
  try {
    parsed = JSON.parse(json);
  } catch {
    fallback.fallbackReason = "PARSE_ERROR";
    return fallback;
  }

  if (typeof parsed.answer !== "string" || !Array.isArray(parsed.citations)) {
    fallback.fallbackReason = "PARSE_ERROR";
    return fallback;
  }

  const allowedCardIds = new Set(evidence.map((r) => r.card.id));
  const citations = parsed.citations
    .map((citation) => {
      if (!citation || typeof citation !== "object" || !("cardId" in citation) || !("claimText" in citation)) return null;
      const cardId = String(citation.cardId);
      const claimText = String(citation.claimText).trim();
      if (!allowedCardIds.has(cardId) || !claimText) return null;
      return { cardId, claimText } as AnswerCitationDraft;
    })
    .filter((c): c is AnswerCitationDraft => Boolean(c));

  if (!parsed.answer.trim() || citations.length === 0) {
    fallback.fallbackReason = "EMPTY_RESULT";
    return fallback;
  }

  return {
    answerText: appendLimitedAnswerNote(question, parsed.answer.trim()),
    citations,
    answerMode: "LLM",
  };
}
