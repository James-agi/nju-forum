import { chunkKnowledgeCard } from "@/lib/knowledge/chunking";
import { isSpec } from "@/lib/knowledge/scoring";
import type { EvidenceChunk, RetrievalResult } from "@/lib/knowledge/types-internal";

const LOCATION_TERMS = ["鼓楼", "仙林", "浦口", "苏州"];
const SERVICE_TERMS = [
  "洗衣",
  "洗衣店",
  "理发",
  "理发店",
  "剪头发",
  "打印",
  "打印店",
  "快递",
  "外卖",
  "食堂",
  "修车",
  "自行车",
  "修理",
  "修理铺",
  "教超",
  "教育超市",
  "便利店",
  "商铺",
  "日用品",
  "生活用品",
  "日化用品",
];
const SERVICE_GROUPS = [
  ["洗衣", "洗衣店"],
  ["理发", "理发店", "剪头发"],
  ["打印", "打印店"],
  ["快递"],
  ["外卖"],
  ["食堂"],
  ["修车", "自行车", "修理", "修理铺"],
  ["教超", "教育超市", "便利店", "商铺", "日用品", "生活用品", "日化用品"],
];

function includesTerm(text: string, term: string) {
  return text.toLowerCase().includes(term.toLowerCase());
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function locationTermsIn(text: string) {
  return LOCATION_TERMS.filter((term) => includesTerm(text, term));
}

function serviceGroupIndex(term: string) {
  const normalized = term.toLowerCase();
  return SERVICE_GROUPS.findIndex((group) => group.some((item) => item.toLowerCase() === normalized));
}

function serviceGroupsForTerms(terms: string[]) {
  return new Set(
    terms
      .map(serviceGroupIndex)
      .filter((index) => index >= 0),
  );
}

function implicitServiceTermsFromSummary(result: RetrievalResult, scoringTerms: string[]) {
  const summary = result.card.summary.toLowerCase();
  const queryServiceTerms = scoringTerms.filter((term) => SERVICE_TERMS.includes(term));
  const queryGroups = serviceGroupsForTerms(queryServiceTerms);
  if (queryGroups.size !== 1) return [];

  const summaryServiceTerms = SERVICE_TERMS.filter((term) => includesTerm(summary, term));
  const summaryGroups = serviceGroupsForTerms(summaryServiceTerms);
  if (summaryGroups.size !== 1) return [];

  const [queryGroup] = Array.from(queryGroups);
  if (!summaryGroups.has(queryGroup)) return [];

  return queryServiceTerms.filter((term) => result.matchedTerms.includes(term));
}

function termScore(term: string, text: string, sectionTitle?: string) {
  const normalized = term.toLowerCase();
  let score = 0;
  if (includesTerm(text, normalized)) score += isSpec(normalized) ? (normalized.length >= 3 ? 5 : 3) : 1;
  if (sectionTitle && includesTerm(sectionTitle, normalized)) score += 3;
  return score;
}

export function scoreEvidenceChunks(result: RetrievalResult, maxChunks = 3): EvidenceChunk[] {
  const queryTerms = result.queryTerms || result.matchedTerms;
  const scoringTerms = unique([...queryTerms, ...result.matchedTerms]).filter((term) => term.trim().length >= 2);
  if (scoringTerms.length === 0) return [];

  const queryLocations = scoringTerms.filter((term) => LOCATION_TERMS.includes(term));
  const isServiceQuery = scoringTerms.some((term) => SERVICE_TERMS.includes(term));
  const implicitServiceTerms = queryLocations.length === 0
    ? implicitServiceTermsFromSummary(result, scoringTerms)
    : [];

  return chunkKnowledgeCard(result.card)
    .map((chunk): EvidenceChunk => {
      const searchable = `${chunk.sectionTitle || ""}\n${chunk.text}`.toLowerCase();
      const chunkLocations = locationTermsIn(searchable);
      const explicitMatchedTerms = scoringTerms.filter((term) => includesTerm(searchable, term));
      const implicitMatchedTerms = chunkLocations.length > 0 && explicitMatchedTerms.length === 0
        ? implicitServiceTerms
        : [];
      const matchedTerms = unique([...explicitMatchedTerms, ...implicitMatchedTerms]);
      let score = matchedTerms.reduce((sum, term) => sum + termScore(term, searchable, chunk.sectionTitle), 0);
      let rejectedByLocation = false;

      if (implicitMatchedTerms.length > 0) {
        score += 6;
      }

      if (queryLocations.length > 0 && chunkLocations.length > 0) {
        const sharesLocation = chunkLocations.some((term) => queryLocations.includes(term));
        if (!sharesLocation) {
          rejectedByLocation = true;
          score = 0;
        } else {
          score += 8;
        }
      }

      if (!rejectedByLocation) {
        if (isServiceQuery && matchedTerms.some((term) => SERVICE_TERMS.includes(term))) score += 4;
        if (matchedTerms.some((term) => result.matchedTerms.includes(term))) score += 2;
      }

      return {
        ...chunk,
        score,
        matchedTerms: unique(matchedTerms),
      };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, maxChunks);
}

export function attachEvidenceChunks(result: RetrievalResult, maxChunks = 3): RetrievalResult {
  const evidenceChunks = scoreEvidenceChunks(result, maxChunks);
  if (evidenceChunks.length === 0) return result;
  return { ...result, evidenceChunks };
}
