import type { RetrievalResult } from "@/lib/knowledge/retrieval";
import { answerCompletion, LlmError } from "@/lib/knowledge/llm-client";
import { LLM_ANSWER_TIMEOUT_MS, LLM_MAX_TOKENS, LLM_TEMPERATURE } from "@/lib/knowledge/config";
import type {
  StructuredAnswer,
  StructuredAnswerBlock,
  StructuredAnswerBlockRole,
  StructuredAnswerShape,
} from "@/lib/knowledge/types";

export interface AnswerCitationDraft {
  cardId: string;
  claimText: string;
}

export type AnswerMode = "LLM" | "FALLBACK";
export type FallbackReason =
  | "NO_CONFIG"
  | "HTTP_ERROR"
  | "TIMEOUT"
  | "PARSE_ERROR"
  | "EMPTY_RESULT"
  | "EXCEPTION"
  | "VALIDATION_FAILED";

export interface CardBoundedAnswer {
  answerText: string;
  structuredAnswer?: StructuredAnswer;
  citations: AnswerCitationDraft[];
  answerMode: AnswerMode;
  fallbackReason?: FallbackReason;
}

interface AnswerValidationResult {
  ok: boolean;
  answerText: string;
  structuredAnswer?: StructuredAnswer;
  reason?: FallbackReason;
}

const SYSTEM_PROMPT =
  "你是 NJU 知识库的溯源问答助手。你的角色仅限于基于提供的知识卡片和证据片段回答问题。" +
  "绝对不能使用通用知识、猜测或补全缺失信息。如果卡片信息不足，如实说明。" +
  "如果 evidenceChunks 存在，必须优先依据 evidenceChunks 中的具体片段作答；整张卡片正文只能作为理解上下文，不能用来发散补全片段未支持的结论。" +
  "不能把卡片里的适用对象、专业、大类、年级或校区假定成用户本人情况；如果卡片只适用于特定对象，必须写成“如果你属于该对象”。" +
  "如果用户没有说明校区，而证据卡片只覆盖某一个校区，不能把该校区地点当作直接答案；必须说明“这张卡只覆盖某校区”，并建议用户补充校区。" +
  "如果证据卡片覆盖多个校区或同时包含通用卡和单校区卡，必须综合多张卡，按校区或适用范围分别归纳，不能只回答第一张卡。" +
  "如果用户问题包含多个子问题、多个地点、多个方式或多个对象，而证据只覆盖其中一部分，必须明确说明哪些部分有证据、哪些部分没有证据，不能把未覆盖部分静默省略。" +
  "如果不同卡片存在限制或例外，必须优先保留限制条件，不能给出与限制相反的确定建议。" +
  "如果问题询问实时状态、当天情况、年度变化、具体余量或精确数值，而卡片只提供一般规则/路径，只能回答一般信息和查询路径，并明确说明不能确认实时或个人化结果。" +
  "回答要面向学生阅读：先给一句短结论，再按问题类型组织短块；每条尽量短，不要把引用卡片标题、来源说明或长摘录硬塞进正文。" +
  "你需要选择一个 answer shape：direct、procedure、comparison、policy、partial、troubleshoot。" +
  "同时输出 structuredAnswer，格式为 {\"shape\":\"...\",\"headline\":\"一句话结论\",\"blocks\":[{\"role\":\"answer|step|requirement|option|risk|action|gap|note\",\"title\":\"...\",\"items\":[\"...\"]}]}。" +
  "blocks 可以按问题需要灵活选择，但每个 block 最多 4 条，每条不超过 120 字。如果只能部分回答，必须包含 role 为 gap 的块。" +
  "输出严格 JSON：{\"answer\":\"...\",\"structuredAnswer\":{...},\"citations\":[{\"cardId\":\"...\",\"claimText\":\"...\"}]}。" +
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
const EXPLICIT_COVERAGE_GROUPS = [
  { terms: ["校车", "班车"], label: "校车/班车" },
];
const GROUNDED_TERM_GROUPS = [
  ["鼓楼"],
  ["仙林"],
  ["浦口"],
  ["苏州"],
  ["工科试验班", "工试"],
  ["技术科学试验班", "技科"],
  ["人工智能", "AI", "ai"],
  ["天文", "天文学"],
  ["法学", "法学院"],
  ["化生", "化学", "生物"],
  ["校车", "班车"],
];
const STRUCTURED_ANSWER_SHAPES = [
  "direct",
  "procedure",
  "comparison",
  "policy",
  "partial",
  "troubleshoot",
] as const satisfies readonly StructuredAnswerShape[];
const STRUCTURED_ANSWER_BLOCK_ROLES = [
  "answer",
  "step",
  "requirement",
  "option",
  "risk",
  "action",
  "gap",
  "note",
] as const satisfies readonly StructuredAnswerBlockRole[];

function isStructuredAnswerShape(value: string): value is StructuredAnswerShape {
  return STRUCTURED_ANSWER_SHAPES.includes(value as StructuredAnswerShape);
}

function isStructuredAnswerBlockRole(value: string): value is StructuredAnswerBlockRole {
  return STRUCTURED_ANSWER_BLOCK_ROLES.includes(value as StructuredAnswerBlockRole);
}

function trimStructuredText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength)}...`;
}

function sanitizeStructuredAnswer(value: unknown): StructuredAnswer | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const shape = typeof raw.shape === "string" && isStructuredAnswerShape(raw.shape)
    ? raw.shape
    : "direct";
  const headline = trimStructuredText(raw.headline, 120);
  if (!headline || !Array.isArray(raw.blocks)) return undefined;

  const blocks = raw.blocks
    .slice(0, 6)
    .map((block): StructuredAnswerBlock | null => {
      if (!block || typeof block !== "object") return null;
      const rawBlock = block as Record<string, unknown>;
      const role = typeof rawBlock.role === "string" && isStructuredAnswerBlockRole(rawBlock.role)
        ? rawBlock.role
        : "note";
      const title = trimStructuredText(rawBlock.title, 32);
      if (!title || !Array.isArray(rawBlock.items)) return null;
      const items = rawBlock.items
        .map((item) => trimStructuredText(item, 160))
        .filter(Boolean)
        .slice(0, 4);
      if (items.length === 0) return null;
      return { role, title, items };
    })
    .filter((block): block is StructuredAnswerBlock => Boolean(block));

  if (blocks.length === 0) return undefined;
  return { shape, headline, blocks };
}

function structuredAnswerText(structuredAnswer: StructuredAnswer | undefined) {
  if (!structuredAnswer) return "";
  return [
    structuredAnswer.headline,
    ...structuredAnswer.blocks.flatMap((block) => [block.title, ...block.items]),
  ].join("\n");
}

function appendNoteBlock(structuredAnswer: StructuredAnswer | undefined, title: string, text: string) {
  const item = trimStructuredText(text, 180);
  if (!structuredAnswer || !item) return structuredAnswer;
  return {
    ...structuredAnswer,
    blocks: [
      ...structuredAnswer.blocks,
      {
        role: "note",
        title,
        items: [item],
      } satisfies StructuredAnswerBlock,
    ].slice(0, 6),
  };
}

function answerShapeForQuestion(question: string): StructuredAnswerShape {
  if (/流程|步骤|申请|办理|怎么弄|怎么做|如何/.test(question)) return "procedure";
  if (/区别|对比|比较|还是|哪个|哪种/.test(question)) return "comparison";
  if (/政策|规定|条件|要求|能不能|是否|可以吗/.test(question)) return "policy";
  if (/故障|失败|出错|打不开|没电|坏了/.test(question)) return "troubleshoot";
  return "direct";
}

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

function evidenceText(evidence: RetrievalResult[]) {
  return evidence.map((result) => {
    const chunks = result.evidenceChunks?.map((chunk) => chunk.text).join("\n") || "";
    return `${result.card.summary}\n${trimForAnswer(result.card.body, 500)}\n${chunks}`;
  }).join("\n");
}

function appendPartialCoverageNote(question: string, answer: string, evidence: RetrievalResult[]) {
  if (answer.includes("证据缺口")) return answer;

  const text = evidenceText(evidence);
  const missingGroups = EXPLICIT_COVERAGE_GROUPS.filter((group) => {
    const asked = group.terms.some((term) => includesTerm(question, term));
    const covered = group.terms.some((term) => includesTerm(text, term));
    return asked && !covered;
  });

  if (missingGroups.length === 0) return answer;

  return `${answer}\n\n证据缺口：当前引用卡片没有覆盖${missingGroups.map((group) => `「${group.label}」`).join("、")}信息，不能确认这部分；以上回答只覆盖引用卡片中已有的信息。`;
}

function appendSingleCampusScopeNote(question: string, answer: string, evidence: RetrievalResult[]) {
  if (LOCATION_TERMS.some((location) => includesTerm(question, location))) return answer;
  if (answer.includes("范围提示")) return answer;

  const locations = evidenceLocationScope(evidence);
  if (locations.length !== 1) return answer;

  return `${answer}\n\n范围提示：以上依据主要覆盖${locations[0]}校区；如果你问的是其他校区，需要补充校区或查对应卡片，不能直接把这条规则推广到所有校区。`;
}

function finalizeAnswerText(question: string, answer: string, evidence: RetrievalResult[]) {
  return appendSingleCampusScopeNote(
    question,
    appendPartialCoverageNote(question, appendLimitedAnswerNote(question, answer), evidence),
    evidence,
  );
}

function hasAnyTerm(text: string, terms: string[]) {
  return terms.some((term) => includesTerm(text, term));
}

function validateGroundedAnswer(
  question: string,
  answer: string,
  citations: AnswerCitationDraft[],
  evidence: RetrievalResult[],
  structuredAnswer?: StructuredAnswer,
): AnswerValidationResult {
  const originalAnswer = answer.trim();
  const answerText = finalizeAnswerText(question, answer, evidence);
  let safeStructuredAnswer = structuredAnswer;
  if (safeStructuredAnswer && answerText !== originalAnswer && answerText.startsWith(originalAnswer)) {
    safeStructuredAnswer = appendNoteBlock(
      safeStructuredAnswer,
      "需要注意",
      answerText.slice(originalAnswer.length).trim(),
    );
  }
  const textToValidate = `${answerText}\n${structuredAnswerText(safeStructuredAnswer)}`;
  const supportedText = `${question}\n${evidenceText(evidence)}`;

  for (const group of GROUNDED_TERM_GROUPS) {
    if (!hasAnyTerm(textToValidate, group)) continue;
    if (hasAnyTerm(supportedText, group)) continue;

    return {
      ok: false,
      answerText,
      reason: "VALIDATION_FAILED",
    };
  }

  const allowedCardIds = new Set(evidence.map((r) => r.card.id));
  if (citations.some((citation) => !allowedCardIds.has(citation.cardId))) {
    return {
      ok: false,
      answerText,
      reason: "VALIDATION_FAILED",
    };
  }

  return {
    ok: true,
    answerText,
    structuredAnswer: safeStructuredAnswer,
  };
}

function trimForAnswer(text: string, maxLength = 320) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength)}...`;
}

function buildDeterministicStructuredAnswer(question: string, evidence: RetrievalResult[]): StructuredAnswer {
  const answerItems = evidence.slice(0, 4).map((result) => {
    const chunkText = result.evidenceChunks?.length
      ? result.evidenceChunks.map((chunk) => trimForAnswer(chunk.text, 140)).join(" / ")
      : trimForAnswer(result.card.body, 140);
    return `${result.card.summary}：${chunkText}`;
  });

  return {
    shape: answerShapeForQuestion(question),
    headline: `针对「${question}」，当前只能根据已匹配到的知识卡片给出有限回答。`,
    blocks: [
      {
        role: "answer",
        title: "可以确认",
        items: answerItems,
      },
      {
        role: "note",
        title: "需要注意",
        items: ["以上内容只来自当前引用卡片；没有被卡片覆盖的细节，不能直接确认。"],
      },
    ],
  };
}

function buildDeterministicAnswer(question: string, evidence: RetrievalResult[]): CardBoundedAnswer {
  const lines = evidence.map((result, index) => {
    const chunkText = result.evidenceChunks?.length
      ? result.evidenceChunks.map((chunk) => trimForAnswer(chunk.text, 220)).join(" / ")
      : trimForAnswer(result.card.body);
    return `${index + 1}. **${result.card.summary}**：${chunkText}`;
  });
  const baseAnswerText = [
    `针对「${question}」，当前只能根据已匹配到的知识卡片给出有限回答。`,
    "",
    "### 可以确认",
    lines.join("\n"),
    "",
    "### 需要注意",
    "以上内容只来自当前引用卡片；没有被卡片覆盖的细节，不能直接确认。",
  ].join("\n");
  const answerText = finalizeAnswerText(question, baseAnswerText, evidence);
  const structuredAnswer = answerText.startsWith(baseAnswerText) && answerText !== baseAnswerText
    ? appendNoteBlock(
        buildDeterministicStructuredAnswer(question, evidence),
        "需要注意",
        answerText.slice(baseAnswerText.length).trim(),
      )
    : buildDeterministicStructuredAnswer(question, evidence);

  return {
    answerText,
    structuredAnswer,
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

    llmContent = await answerCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify(userContent),
        },
      ],
      maxTokens: LLM_MAX_TOKENS,
      temperature: LLM_TEMPERATURE,
      timeoutMs: LLM_ANSWER_TIMEOUT_MS,
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

  let parsed: { answer?: unknown; structuredAnswer?: unknown; citations?: unknown };
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

  const structuredAnswer = sanitizeStructuredAnswer(parsed.structuredAnswer);
  const validation = validateGroundedAnswer(question, parsed.answer.trim(), citations, evidence, structuredAnswer);
  if (!validation.ok) {
    fallback.fallbackReason = validation.reason;
    return fallback;
  }

  return {
    answerText: validation.answerText,
    structuredAnswer: validation.structuredAnswer,
    citations,
    answerMode: "LLM",
  };
}
