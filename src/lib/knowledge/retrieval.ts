import type { KnowledgeCard } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeQuestionText } from "@/lib/knowledge/validation";

export type RetrievalCard = Pick<
  KnowledgeCard,
  | "id"
  | "summary"
  | "body"
  | "sourceExcerpt"
  | "sourceUrl"
  | "sourceDescription"
  | "sourceType"
  | "verificationStatus"
  | "domainTag"
  | "createdAt"
  | "updatedAt"
  | "archivedAt"
>;

export interface RetrievalResult {
  card: RetrievalCard;
  score: number;
  matchedTerms: string[];
}

export interface EvidenceEvaluation {
  sufficient: boolean;
  reason?: "EMPTY" | "ARCHIVED" | "UNRELATED" | "NEEDS_REVIEW";
  cards: RetrievalResult[];
}

const STOP_TERMS = new Set([
  "怎么",
  "如何",
  "什么",
  "一下",
  "可以",
  "需要",
  "有没有",
  "请问",
  "这个",
  "那个",
  "是否",
  "能否",
  "能不能",
]);

const GENERIC_TERMS = new Set([
  ...Array.from(STOP_TERMS),
  "南京",
  "大学",
  "南大",
  "南京大学",
  "学校",
  "相关",
  "问题",
  "信息",
  "内容",
  "规定",
  "流程",
  "办法",
  "申请",
  "办理",
  "知道",
  "了解",
  "新生",
  "入学",
  "新生入学",
]);

const SPECIFIC_SHORT_TERMS = new Set([
  "报到",
  "修读",
  "选课",
  "保研",
  "军训",
  "宿舍",
  "床位",
  "医保",
  "学费",
  "缴费",
  "学籍",
  "体检",
  "户口",
  "档案",
  "院系",
  "竞赛",
  "科研",
  "食堂",
  "校车",
  "vpn",
  "一卡通",
  "校园卡",
  "图书馆",
  "奖学金",
  "助学金",
  "转专业",
  "三三制",
]);

const RETRIEVAL_ALIASES: Array<{ keywords: string[]; terms: string[] }> = [
  { keywords: ["怎么修", "如何修", "修什么"], terms: ["修读"] },
  { keywords: ["怎么选", "如何选"], terms: ["选课"] },
  { keywords: ["怎么交", "如何交"], terms: ["缴费"] },
  { keywords: ["哪里住", "住哪里"], terms: ["宿舍"] },
];

const MIN_SUFFICIENT_SCORE = 12;
const MIN_STRONG_TERM_COUNT = 2;
const MIN_SINGLE_ANCHOR_SCORE = 16;

function isSpecificTerm(term: string) {
  const normalized = term.toLowerCase();
  if (GENERIC_TERMS.has(normalized)) return false;
  if (SPECIFIC_SHORT_TERMS.has(normalized)) return true;
  if (/^[a-z0-9]{2,}$/i.test(normalized)) return true;
  return normalized.length >= 3;
}

function scoreForTerm(term: string, field: "summary" | "body" | "domain" | "source") {
  const specific = isSpecificTerm(term);

  if (!specific) {
    return field === "summary" ? 1 : 0;
  }

  if (field === "summary") {
    if (term.length >= 5) return 7;
    if (term.length >= 3) return 5;
    return 3;
  }

  if (field === "body") {
    if (term.length >= 5) return 5;
    if (term.length >= 3) return 3;
    return 1;
  }

  if (field === "domain") {
    return term.length >= 3 ? 2 : 1;
  }

  return 1;
}

export function extractRetrievalTerms(question: string) {
  const normalized = normalizeQuestionText(question);
  const terms = new Set<string>();

  if (normalized.length >= 2) {
    terms.add(normalized);
  }

  for (const alias of RETRIEVAL_ALIASES) {
    if (alias.keywords.some((keyword) => normalized.includes(keyword))) {
      alias.terms.forEach((term) => terms.add(term));
    }
  }

  const chunks = normalized.match(/[0-9a-zA-Z\u3400-\u9fff]{2,}/g) ?? [];
  for (const chunk of chunks) {
    if (!STOP_TERMS.has(chunk)) terms.add(chunk);

    if (/[\u3400-\u9fff]/.test(chunk) && chunk.length > 3) {
      for (let size = 2; size <= Math.min(5, chunk.length); size += 1) {
        for (let index = 0; index <= chunk.length - size; index += 1) {
          const gram = chunk.slice(index, index + size);
          if (!STOP_TERMS.has(gram)) terms.add(gram);
        }
      }
    }
  }

  return Array.from(terms)
    .filter((term) => term.length >= 2)
    .sort((a, b) => b.length - a.length)
    .slice(0, 12);
}

export function scoreCard(card: RetrievalCard, terms: string[]) {
  const summary = card.summary.toLowerCase();
  const body = card.body.toLowerCase();
  const domainTag = card.domainTag.toLowerCase();
  const sourceDescription = card.sourceDescription.toLowerCase();
  const matchedTerms: string[] = [];

  let score = 0;

  for (const term of terms) {
    const normalizedTerm = term.toLowerCase();
    let matched = false;

    if (summary.includes(normalizedTerm)) {
      score += scoreForTerm(normalizedTerm, "summary");
      matched = true;
    }

    if (body.includes(normalizedTerm)) {
      score += scoreForTerm(normalizedTerm, "body");
      matched = true;
    }

    if (domainTag.includes(normalizedTerm)) {
      score += scoreForTerm(normalizedTerm, "domain");
      matched = true;
    }

    if (sourceDescription.includes(normalizedTerm)) {
      score += scoreForTerm(normalizedTerm, "source");
      matched = true;
    }

    if (matched) matchedTerms.push(term);
  }

  if (card.verificationStatus === "VERIFIED") score += 1;
  if (card.verificationStatus === "NEEDS_REVIEW") score -= 1;
  if (card.sourceType === "OFFICIAL") score += 1;

  return {
    score: Math.max(0, score),
    matchedTerms: Array.from(new Set(matchedTerms)),
  };
}

function hasStrongEvidence(result: RetrievalResult) {
  const summary = result.card.summary.toLowerCase();
  const body = result.card.body.toLowerCase();
  const strongTerms = result.matchedTerms.filter(isSpecificTerm);
  const contentStrongTerms = strongTerms.filter((term) => {
    const normalized = term.toLowerCase();
    return summary.includes(normalized) || body.includes(normalized);
  });
  const hasLongContentAnchor = contentStrongTerms.some((term) => term.length >= 4);
  const hasMultipleContentAnchors = contentStrongTerms.length >= MIN_STRONG_TERM_COUNT;

  return (
    result.score >= MIN_SUFFICIENT_SCORE &&
    (hasMultipleContentAnchors ||
      (hasLongContentAnchor && result.score >= MIN_SINGLE_ANCHOR_SCORE))
  );
}

export async function retrieveKnowledgeCards(question: string, limit = 5) {
  const terms = extractRetrievalTerms(question);
  if (terms.length === 0) return [];

  const orFilters = terms.flatMap((term) => [
    { summary: { contains: term, mode: "insensitive" as const } },
    { body: { contains: term, mode: "insensitive" as const } },
    { domainTag: { contains: term, mode: "insensitive" as const } },
    { sourceDescription: { contains: term, mode: "insensitive" as const } },
  ]);

  const cards = await db.knowledgeCard.findMany({
    where: {
      archivedAt: null,
      OR: orFilters,
    },
    take: 50,
    orderBy: [{ verificationStatus: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      summary: true,
      body: true,
      sourceExcerpt: true,
      sourceUrl: true,
      sourceDescription: true,
      sourceType: true,
      verificationStatus: true,
      domainTag: true,
      createdAt: true,
      updatedAt: true,
      archivedAt: true,
    },
  });

  return cards
    .map((card) => ({
      card,
      ...scoreCard(card, terms),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || b.card.updatedAt.getTime() - a.card.updatedAt.getTime())
    .slice(0, limit);
}

export function evaluateEvidence(results: RetrievalResult[]): EvidenceEvaluation {
  if (results.length === 0) {
    return { sufficient: false, reason: "EMPTY", cards: [] };
  }

  const active = results.filter((result) => !result.card.archivedAt);
  if (active.length === 0) {
    return { sufficient: false, reason: "ARCHIVED", cards: [] };
  }

  const topScore = active[0]?.score ?? 0;
  if (topScore < MIN_SUFFICIENT_SCORE || !hasStrongEvidence(active[0])) {
    return { sufficient: false, reason: "UNRELATED", cards: [] };
  }

  const usable = active
    .filter(
      (result) =>
        result.score >= Math.max(MIN_SUFFICIENT_SCORE, topScore - 2) &&
        hasStrongEvidence(result)
    )
    .slice(0, 3);

  if (usable.every((result) => result.card.verificationStatus === "NEEDS_REVIEW")) {
    return { sufficient: false, reason: "NEEDS_REVIEW", cards: [] };
  }

  return { sufficient: true, cards: usable };
}
