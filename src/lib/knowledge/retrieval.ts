import { db } from "@/lib/db";
import { extractRetrievalTerms } from "@/lib/knowledge/term-extraction";
import { scoreCard } from "@/lib/knowledge/scoring";
import { embedQuery } from "@/lib/knowledge/embedding";
import { hasVectors, semanticSearch } from "@/lib/knowledge/vector-store";
import {
  KEYWORD_RETRIEVAL_LIMIT,
  KEYWORD_TOP_CUT,
  MAX_MERGED_TERMS,
  SEMANTIC_TOP_K,
  SEMANTIC_SIMILARITY_THRESHOLD,
  RRF_K,
} from "@/lib/knowledge/config";
import type { RetrievalResult } from "@/lib/knowledge/types-internal";

// ---- Re-exports for backward compatibility ----
export type { RetrievalCard, RetrievalResult } from "@/lib/knowledge/types-internal";
export type { EvidenceEvaluation } from "@/lib/knowledge/evidence";
export { scoreCard } from "@/lib/knowledge/scoring";
export { evaluateEvidence } from "@/lib/knowledge/evidence";
export { extractRetrievalTerms } from "@/lib/knowledge/term-extraction";

// ---- Orchestrator ----

export async function retrieveKnowledgeCards(
  question: string,
  limit = 5,
  extraTerms: string[] = [],
): Promise<RetrievalResult[]> {
  const baseTerms = await extractRetrievalTerms(question);
  const merged = new Set([...baseTerms, ...extraTerms.filter((t) => t.length >= 2)]);
  const terms = Array.from(merged).slice(0, MAX_MERGED_TERMS);

  if (terms.length === 0) return [];

  const or = terms.flatMap((t) => [
    { summary: { contains: t, mode: "insensitive" as const } },
    { body: { contains: t, mode: "insensitive" as const } },
    { domainTag: { contains: t, mode: "insensitive" as const } },
    { sourceDescription: { contains: t, mode: "insensitive" as const } },
  ]);

  const cards = await db.knowledgeCard.findMany({
    where: { archivedAt: null, OR: or },
    take: KEYWORD_RETRIEVAL_LIMIT,
    orderBy: [{ verificationStatus: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true, summary: true, body: true, sourceExcerpt: true, sourceUrl: true,
      sourceDescription: true, sourceType: true, verificationStatus: true,
      domainTag: true, createdAt: true, updatedAt: true, archivedAt: true,
    },
  });

  return cards
    .map((c) => ({ card: c, queryTerms: terms, ...scoreCard(c, terms) }))
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
    const cards = await db.knowledgeCard.findMany({
      where: { id: { in: missingIds }, archivedAt: null },
      select: {
        id: true, summary: true, body: true, sourceExcerpt: true, sourceUrl: true,
        sourceDescription: true, sourceType: true, verificationStatus: true,
        domainTag: true, createdAt: true, updatedAt: true, archivedAt: true,
      },
    });
    semanticOnlyResults = cards
      .map((c) => ({ card: c, queryTerms: allTerms, ...scoreCard(c, allTerms) }))
      .filter((r) => r.score > 0);
  }

  const allResults = [...keywordResults, ...semanticOnlyResults];
  const resultMap = new Map(allResults.map((r) => [r.card.id, r]));

  const sorted = Array.from(rrfScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([cardId]) => resultMap.get(cardId))
    .filter((r): r is RetrievalResult => !!r);

  return sorted;
}
