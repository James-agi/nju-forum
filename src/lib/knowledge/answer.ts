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
  "你是 NJU 知识库的溯源问答助手。你的角色仅限于基于提供的知识卡片和证据片段回答问题。" +
  "绝对不能使用通用知识、猜测或补全缺失信息。如果卡片信息不足，如实说明。" +
  "如果 evidenceChunks 存在，必须优先依据 evidenceChunks 中的具体片段作答；整张卡片正文只能作为理解上下文，不能用来发散补全片段未支持的结论。" +
  "不能把卡片里的适用对象、专业、大类、年级或校区假定成用户本人情况；如果卡片只适用于特定对象，必须写成“如果你属于该对象”。" +
  "如果用户没有说明校区，而证据卡片只覆盖某一个校区，不能把该校区地点当作直接答案；必须说明“这张卡只覆盖某校区”，并建议用户补充校区。" +
  "如果证据卡片覆盖多个校区或同时包含通用卡和单校区卡，必须综合多张卡，按校区或适用范围分别归纳，不能只回答第一张卡。" +
  "如果不同卡片存在限制或例外，必须优先保留限制条件，不能给出与限制相反的确定建议。" +
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
const LOCATION_TERMS = ["鼓楼", "仙林", "浦口", "苏州"];

function needsLimitedAnswerNote(question: string) {
  return LIMITED_ANSWER_PATTERNS.some((pattern) => pattern.test(question));
}

function appendLimitedAnswerNote(question: string, answer: string) {
  if (!needsLimitedAnswerNote(question)) return answer;
  if (answer.includes("知识库只能提供已有卡片里的通用信息和查询路径")) return answer;
  return `${answer}\n\n${LIMITED_ANSWER_NOTE}`;
}

function includesTerm(text: string, term: string) {
  return text.toLowerCase().includes(term.toLowerCase());
}

function locationsIn(text: string) {
  return LOCATION_TERMS.filter((term) => includesTerm(text, term));
}

function evidenceLocationScope(evidence: RetrievalResult[]) {
  const locations = new Set<string>();

  for (const result of evidence) {
    const text = result.evidenceChunks?.length
      ? [
          result.card.summary,
          ...result.evidenceChunks.map((chunk) => `${chunk.sectionTitle || ""}\n${chunk.text}`),
        ].join("\n")
      : `${result.card.summary}\n${result.card.body}`;
    locationsIn(text).forEach((location) => locations.add(location));
  }

  return Array.from(locations);
}

function appendSingleCampusScopeNote(question: string, answer: string, evidence: RetrievalResult[]) {
  if (LOCATION_TERMS.some((location) => includesTerm(question, location))) return answer;
  if (answer.includes("范围提示")) return answer;

  const locations = evidenceLocationScope(evidence);
  if (locations.length !== 1) return answer;

  return `${answer}\n\n范围提示：以上依据主要覆盖${locations[0]}校区；如果你问的是其他校区，需要补充校区或查对应卡片，不能直接把这条规则推广到所有校区。`;
}

function finalizeAnswerText(question: string, answer: string, evidence: RetrievalResult[]) {
  return appendSingleCampusScopeNote(question, appendLimitedAnswerNote(question, answer), evidence);
}

function trimForAnswer(text: string, maxLength = 320) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength)}...`;
}

function buildDeterministicAnswer(question: string, evidence: RetrievalResult[]): CardBoundedAnswer {
  const lines = evidence.map((result, index) => {
    const chunkText = result.evidenceChunks?.length
      ? result.evidenceChunks.map((chunk) => trimForAnswer(chunk.text, 220)).join(" / ")
      : trimForAnswer(result.card.body);
    return `${index + 1}. ${result.card.summary}：${chunkText}`;
  });

  return {
    answerText: finalizeAnswerText(
      question,
      `根据知识库中可引用的卡片，针对「${question}」目前只能确认：\n${lines.join("\n")}`,
      evidence,
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
      body: result.evidenceChunks?.length ? trimForAnswer(result.card.body, 500) : result.card.body,
      evidenceChunks: result.evidenceChunks?.map((chunk) => ({
        chunkId: chunk.chunkId,
        sectionTitle: chunk.sectionTitle,
        text: chunk.text,
        matchedTerms: chunk.matchedTerms,
      })) || [],
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
    answerText: finalizeAnswerText(question, parsed.answer.trim(), evidence),
    citations,
    answerMode: "LLM",
  };
}
