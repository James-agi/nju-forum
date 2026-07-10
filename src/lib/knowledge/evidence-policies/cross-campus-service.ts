import {
  detectCrossCampusServiceIntent,
  locationsInText,
  textCoversServiceTopicAsMain,
  textHasCrossCampusCoverage,
} from "@/lib/knowledge/query-intent";
import type { RetrievalResult } from "@/lib/knowledge/types-internal";
import {
  directAnswerQuestionText,
  evidenceSearchText,
} from "@/lib/knowledge/evidence-text";

function crossCampusServiceIntent(result: RetrievalResult) {
  return detectCrossCampusServiceIntent(directAnswerQuestionText(result), result.queryTerms || []);
}

export function isCrossCampusServiceQuery(result: RetrievalResult) {
  return Boolean(crossCampusServiceIntent(result));
}

function cardCampusCoverage(result: RetrievalResult) {
  return locationsInText(evidenceSearchText(result));
}

export function cardCoversCrossCampusService(result: RetrievalResult, minLimitedBroadScore: number) {
  const intent = crossCampusServiceIntent(result);
  if (!intent) return false;
  if (result.card.verificationStatus !== "VERIFIED") return false;
  if (result.score < minLimitedBroadScore) return false;
  const titleText = `${result.card.summary}\n${result.card.domainTag}`;
  const bodyText = `${result.card.body}\n${result.card.sourceExcerpt || ""}`;
  return textCoversServiceTopicAsMain(titleText, bodyText, intent.topic) &&
    textHasCrossCampusCoverage(titleText, evidenceSearchText(result));
}

export function isCrossCampusServiceResults(results: RetrievalResult[]) {
  return results.some(isCrossCampusServiceQuery);
}

export function prioritizeCrossCampusServiceEvidence(results: RetrievalResult[]) {
  if (!isCrossCampusServiceResults(results)) return results;

  const sorted = [...results].sort((a, b) =>
    b.score - a.score || b.card.updatedAt.getTime() - a.card.updatedAt.getTime(),
  );
  const selected: RetrievalResult[] = [];
  const coveredCampuses = new Set<string>();

  for (const result of sorted) {
    const campuses = cardCampusCoverage(result);
    const addsCampus = campuses.some((campus) => !coveredCampuses.has(campus));
    if (!addsCampus && selected.length > 0) continue;

    selected.push(result);
    campuses.forEach((campus) => coveredCampuses.add(campus));
  }

  return [
    ...selected,
    ...sorted.filter((result) => !selected.includes(result)),
  ];
}
