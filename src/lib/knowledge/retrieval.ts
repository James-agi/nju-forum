import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { extractRetrievalTerms } from "@/lib/knowledge/term-extraction";
import { scoreCard, isSpec } from "@/lib/knowledge/scoring";
import { embedQuery } from "@/lib/knowledge/embedding";
import { hasVectors, semanticSearch } from "@/lib/knowledge/vector-store";
import { GENERIC, STOP } from "@/lib/knowledge/lexicon";
import {
  KEYWORD_TOP_CUT,
  MAX_MERGED_TERMS,
  RETRIEVAL_CANDIDATE_MAX_COUNT,
  RETRIEVAL_CANDIDATE_MIN_COUNT,
  RETRIEVAL_MIN_STRONG_GATE_TERMS,
  SEMANTIC_TOP_K,
  SEMANTIC_SIMILARITY_THRESHOLD,
  RRF_K,
} from "@/lib/knowledge/config";
import type { RetrievalResult } from "@/lib/knowledge/types-internal";
import {
  CAMPUS_TERMS,
  SERVICE_TOPICS,
  detectCrossCampusServiceIntent,
  detectServiceTopic,
  textCoversServiceTopicAsMain,
  textHasCrossCampusCoverage,
  textCoversServiceTopic,
} from "@/lib/knowledge/query-intent";

// ---- Re-exports for backward compatibility ----
export type { RetrievalCard, RetrievalResult } from "@/lib/knowledge/types-internal";
export type { EvidenceEvaluation } from "@/lib/knowledge/evidence";
export { scoreCard } from "@/lib/knowledge/scoring";
export { evaluateEvidence } from "@/lib/knowledge/evidence";
export { extractRetrievalTerms } from "@/lib/knowledge/term-extraction";

// ---- Orchestrator ----

const SPECIFIC_TRANSFER_MARKER_GROUPS = [
  ["法学"],
  ["化生", "化学", "生物"],
  ["光电"],
  ["cs", "计算机", "计科"],
  ["软件", "软工"],
  ["人工智能", "人工智能学院", "ai"],
  ["智能科学", "智科"],
  ["电子", "ee"],
  ["工科试验班", "工试"],
  ["技科", "技术科学", "技术科学试验班"],
  ["数理", "数理大类", "数学", "物理", "天文", "天文学", "大气"],
  ["地学", "地学大类", "地科", "地海"],
  ["信管", "信息管理"],
  ["德语法学"],
  ["马克思主义"],
];

const TRANSFER_ACTION_TERMS = [
  "转专业",
  "转入",
  "转出",
  "准入",
  "跨大类",
  "分流",
  "二次选拔",
  "拔尖",
  "大一转",
  "大二转",
];

const LOCATION_TERMS: string[] = [...CAMPUS_TERMS];
const RETRIEVAL_CARD_SELECT = {
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
} satisfies Prisma.KnowledgeCardSelect;

const LOCATION_SENSITIVE_SERVICE_TERMS = Array.from(
  new Set(SERVICE_TOPICS.flatMap((topic) => [...topic.queryTerms, ...topic.evidenceTerms])),
);

const WEAK_GATE_TERMS = new Set([
  "失败",
  "建议",
  "分别",
  "情况",
  "限制",
  "申请",
  "流程",
  "办理",
  "预约",
  "预约方式",
  "咨询",
  "咨询预约",
  "中心",
  "相关",
  "信息",
  "问题",
  "可以",
  "需要",
  "知道",
  "了解",
  "哪个",
  "哪些",
  "哪里",
  "哪儿",
  "有点",
  "弱弱",
  "一句",
  "经验",
  "不确定",
  "确定",
  "求稳",
  "说法",
  "谢谢",
  "所有",
  "所有校区",
  "各校区",
  "全校区",
  "每个校区",
  "不同校区",
  "汇总",
  "对比",
]);

function includesTerm(text: string, term: string) {
  return text.toLowerCase().includes(term.toLowerCase());
}

function isStrongGateTerm(term: string) {
  const normalized = term.trim().toLowerCase();
  if (normalized.length < 2) return false;
  if (STOP.has(normalized) || GENERIC.has(normalized)) return false;
  if (WEAK_GATE_TERMS.has(normalized)) return false;
  return isSpec(normalized);
}

function getKeywordGateTerms(terms: string[]) {
  return Array.from(new Set(terms.filter(isStrongGateTerm)));
}

function buildCandidateWhere(gateTerms: string[]): Prisma.KnowledgeCardWhereInput {
  const contains = (term: string) => ({ contains: term, mode: "insensitive" as const });

  return {
    archivedAt: null,
    OR: gateTerms.flatMap((term) => [
      { summary: contains(term) },
      { body: contains(term) },
      { sourceExcerpt: contains(term) },
      { sourceDescription: contains(term) },
      { domainTag: contains(term) },
    ]),
  };
}

async function findAllActiveCards() {
  return db.knowledgeCard.findMany({
    where: { archivedAt: null },
    select: RETRIEVAL_CARD_SELECT,
  });
}

async function findSafeCandidateCards(gateTerms: string[]) {
  if (gateTerms.length < RETRIEVAL_MIN_STRONG_GATE_TERMS) {
    return null;
  }

  const where = buildCandidateWhere(gateTerms);
  const candidateCount = await db.knowledgeCard.count({ where });

  if (
    candidateCount < RETRIEVAL_CANDIDATE_MIN_COUNT ||
    candidateCount > RETRIEVAL_CANDIDATE_MAX_COUNT
  ) {
    return null;
  }

  return db.knowledgeCard.findMany({
    where,
    select: RETRIEVAL_CARD_SELECT,
  });
}

function cardMatchesKeywordGate(card: RetrievalResult["card"], gateTerms: string[]) {
  if (gateTerms.length === 0) return false;

  const searchable = [
    card.summary,
    card.body,
    card.sourceExcerpt ?? "",
    card.sourceDescription,
    card.domainTag,
  ].join("\n");

  return gateTerms.some((term) => includesTerm(searchable, term));
}

function cardSearchText(card: RetrievalResult["card"]) {
  return [
    card.summary,
    card.body,
    card.sourceExcerpt ?? "",
    card.sourceDescription,
    card.domainTag,
  ].join("\n");
}

function namesDifferentLocationContext(card: RetrievalResult["card"], terms: string[]) {
  const queryLocations = terms.filter((term) => LOCATION_TERMS.includes(term));
  if (queryLocations.length === 0) return false;

  const summary = card.summary.toLowerCase();
  const summaryLocations = LOCATION_TERMS.filter((term) => summary.includes(term.toLowerCase()));
  if (summaryLocations.length === 0) return false;

  return !summaryLocations.some((term) => queryLocations.includes(term));
}

function namesLocationWithoutQueryContext(card: RetrievalResult["card"], terms: string[], question: string) {
  if (detectCrossCampusServiceIntent(question, terms)) return false;
  if (terms.some((term) => LOCATION_TERMS.includes(term))) return false;
  if (!terms.some((term) => LOCATION_SENSITIVE_SERVICE_TERMS.includes(term))) return false;

  const summary = card.summary.toLowerCase();
  return LOCATION_TERMS.some((term) => summary.includes(term.toLowerCase())) &&
    LOCATION_SENSITIVE_SERVICE_TERMS.some((term) => summary.includes(term.toLowerCase()));
}

function isLocationNeutralServiceCard(card: RetrievalResult["card"], terms: string[]) {
  if (terms.some((term) => LOCATION_TERMS.includes(term))) return false;
  if (!terms.some((term) => LOCATION_SENSITIVE_SERVICE_TERMS.includes(term))) return false;

  const summary = card.summary.toLowerCase();
  return !LOCATION_TERMS.some((term) => summary.includes(term.toLowerCase())) &&
    LOCATION_SENSITIVE_SERVICE_TERMS.some((term) => summary.includes(term.toLowerCase()));
}

function missesQueryServiceTopic(card: RetrievalResult["card"], question: string, terms: string[]) {
  const topic = detectServiceTopic(question, terms);
  if (!topic) return false;
  return !textCoversServiceTopic(cardSearchText(card), topic);
}

function coversQueryServiceTopic(card: RetrievalResult["card"], question: string, terms: string[]) {
  const topic = detectServiceTopic(question, terms);
  if (!topic) return false;
  return textCoversServiceTopic(cardSearchText(card), topic);
}

function coversCrossCampusServiceIntent(card: RetrievalResult["card"], question: string, terms: string[]) {
  const intent = detectCrossCampusServiceIntent(question, terms);
  if (!intent) return false;

  const titleText = `${card.summary}\n${card.domainTag}`;
  const bodyText = `${card.body}\n${card.sourceExcerpt || ""}`;
  return textCoversServiceTopicAsMain(titleText, bodyText, intent.topic) &&
    textHasCrossCampusCoverage(titleText, cardSearchText(card));
}

function isTransferQuery(question: string, terms: string[]) {
  const normalized = question.toLowerCase();
  return normalized.includes("转专业") ||
    normalized.includes("换专业") ||
    normalized.includes("跨大类准入") ||
    terms.some((term) => ["转专业", "换专业", "专业转换", "跨大类准入"].includes(term.toLowerCase()));
}

function findSpecificTransferMarkerGroups(text: string) {
  const normalized = text.toLowerCase();
  const matched = new Set<number>();
  SPECIFIC_TRANSFER_MARKER_GROUPS.forEach((markers, index) => {
    if (markers.some((marker) => normalized.includes(marker))) {
      matched.add(index);
    }
  });
  return matched;
}

function countSharedSpecificTransferGroups(question: string, card: RetrievalResult["card"]) {
  const questionGroups = findSpecificTransferMarkerGroups(question);
  if (questionGroups.size === 0) return 0;

  const cardGroups = findSpecificTransferMarkerGroups(`${card.summary}\n${card.body}`);
  let shared = 0;
  questionGroups.forEach((group) => {
    if (cardGroups.has(group)) shared += 1;
  });
  return shared;
}

function namesDifferentSpecificTransferContext(question: string, card: RetrievalResult["card"]) {
  const summaryGroups = findSpecificTransferMarkerGroups(card.summary);
  if (summaryGroups.size === 0) return false;

  const questionGroups = findSpecificTransferMarkerGroups(question);
  if (questionGroups.size === 0) return true;

  return !Array.from(summaryGroups).some((group) => questionGroups.has(group));
}

function hasTransferActionContext(card: RetrievalResult["card"], matchedTerms: string[]) {
  const normalizedText = `${card.summary}\n${card.body}`.toLowerCase();
  return TRANSFER_ACTION_TERMS.some((term) => {
    const normalizedTerm = term.toLowerCase();
    return matchedTerms.some((matched) => matched.toLowerCase() === normalizedTerm) ||
      normalizedText.includes(normalizedTerm);
  });
}

function adjustContextualScore(
  card: RetrievalResult["card"],
  score: number,
  question: string,
  terms: string[],
  matchedTerms: string[],
) {
  const hasCrossCampusServiceIntent = Boolean(detectCrossCampusServiceIntent(question, terms));
  if (hasCrossCampusServiceIntent && !coversCrossCampusServiceIntent(card, question, terms)) {
    return 0;
  }

  if (missesQueryServiceTopic(card, question, terms)) {
    return 0;
  }

  if (namesDifferentLocationContext(card, terms)) {
    score = 0;
  }

  if (namesLocationWithoutQueryContext(card, terms, question)) {
    score = Math.max(0, score - 3);
  }

  if (isLocationNeutralServiceCard(card, terms)) {
    score += 8;
  }

  if (hasCrossCampusServiceIntent && coversQueryServiceTopic(card, question, terms)) {
    score += 4;
  }

  if (isTransferQuery(question, terms)) {
    if (!hasTransferActionContext(card, matchedTerms)) {
      score = 0;
    }

    const sharedSpecificGroups = countSharedSpecificTransferGroups(question, card);
    if (sharedSpecificGroups >= 2) {
      score += 6;
    }

    if (namesDifferentSpecificTransferContext(question, card)) {
      score = Math.max(0, score - 10);
    }
  }

  return score;
}

export async function retrieveKnowledgeCards(
  question: string,
  limit = 5,
  extraTerms: string[] = [],
): Promise<RetrievalResult[]> {
  const baseTerms = await extractRetrievalTerms(question);
  const merged = new Set([...baseTerms, ...extraTerms.filter((t) => t.length >= 2)]);
  const terms = Array.from(merged).slice(0, MAX_MERGED_TERMS);
  const gateTerms = getKeywordGateTerms(terms);

  if (terms.length === 0 || gateTerms.length === 0) return [];

  const cards = (await findSafeCandidateCards(gateTerms)) ?? await findAllActiveCards();

  return cards
    .filter((c) => cardMatchesKeywordGate(c, gateTerms))
    .map((c) => {
      const scored = scoreCard(c, terms);
      return {
        card: c,
        question,
        queryTerms: terms,
        originalQueryTerms: baseTerms,
        ...scored,
        score: adjustContextualScore(c, scored.score, question, terms, scored.matchedTerms),
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.card.updatedAt.getTime() - a.card.updatedAt.getTime())
    .slice(0, limit);
}

export async function retrieveHybrid(
  question: string,
  limit = 5,
  extraTerms: string[] = [],
): Promise<RetrievalResult[]> {
  const keywordResults = await retrieveKnowledgeCards(question, KEYWORD_TOP_CUT, extraTerms);

  let semanticCardIds: string[] = [];
  if (await hasVectors()) {
    const queryVec = await embedQuery(question);
    if (queryVec) {
      const semResults = await semanticSearch(queryVec, SEMANTIC_TOP_K);
      semanticCardIds = semResults
        .filter((r) => r.similarity > SEMANTIC_SIMILARITY_THRESHOLD)
        .map((r) => r.cardId);
    }
  }

  if (semanticCardIds.length === 0) {
    return keywordResults.slice(0, limit);
  }

  const rrfScores = new Map<string, number>();

  keywordResults.forEach((r, idx) => {
    rrfScores.set(r.card.id, (rrfScores.get(r.card.id) || 0) + 1 / (RRF_K + idx + 1));
  });

  semanticCardIds.forEach((cardId, idx) => {
    rrfScores.set(cardId, (rrfScores.get(cardId) || 0) + 1 / (RRF_K + idx + 1));
  });

  const keywordCardIds = new Set(keywordResults.map((r) => r.card.id));
  const missingIds = semanticCardIds.filter((id) => !keywordCardIds.has(id));

  let semanticOnlyResults: RetrievalResult[] = [];
  if (missingIds.length > 0) {
    const terms = await extractRetrievalTerms(question);
    const allTerms = Array.from(new Set([...terms, ...extraTerms.filter((t) => t.length >= 2)]));
    const gateTerms = getKeywordGateTerms(allTerms);
    const cards = await db.knowledgeCard.findMany({
      where: { id: { in: missingIds }, archivedAt: null },
      select: RETRIEVAL_CARD_SELECT,
    });
    semanticOnlyResults = cards
      .filter((c) => cardMatchesKeywordGate(c, gateTerms))
      .map((c) => {
        const scored = scoreCard(c, allTerms);
        return {
          card: c,
          question,
          queryTerms: allTerms,
          originalQueryTerms: terms,
          ...scored,
          score: adjustContextualScore(c, scored.score, question, allTerms, scored.matchedTerms),
        };
      })
      .filter((r) => r.score > 0);
  }

  const allResults = [...keywordResults, ...semanticOnlyResults];
  const resultMap = new Map(allResults.map((r) => [r.card.id, r]));

  const rrfSorted = Array.from(rrfScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cardId]) => resultMap.get(cardId))
    .filter((r): r is RetrievalResult => !!r);

  const merged = new Map<string, RetrievalResult>();
  for (const result of keywordResults.slice(0, limit)) merged.set(result.card.id, result);
  for (const result of rrfSorted) {
    if (merged.size >= limit) break;
    merged.set(result.card.id, result);
  }

  return Array.from(merged.values()).slice(0, limit);
}
