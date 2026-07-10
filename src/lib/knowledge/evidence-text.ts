import type { RetrievalResult } from "@/lib/knowledge/types-internal";

const FALSE_POSITIVE_PREFIXES: Record<string, string[]> = {
  "\u62a5\u5230": ["\u7533"],
};

function isFalsePositiveTermMatch(text: string, term: string, index: number) {
  const prefixes = FALSE_POSITIVE_PREFIXES[term];
  if (!prefixes) return false;
  const before = index > 0 ? text[index - 1] : "";
  return prefixes.includes(before);
}

export function includesReliableTerm(text: string, term: string) {
  const normalizedText = text.toLowerCase();
  const normalizedTerm = term.toLowerCase();
  let index = normalizedText.indexOf(normalizedTerm);

  while (index >= 0) {
    if (!isFalsePositiveTermMatch(normalizedText, normalizedTerm, index)) {
      return true;
    }
    index = normalizedText.indexOf(normalizedTerm, index + normalizedTerm.length);
  }

  return false;
}

export function uniqueTerms(terms: string[]) {
  return Array.from(new Set(terms.map((term) => term.toLowerCase())));
}

export function evidenceSearchText(result: RetrievalResult) {
  return [
    result.card.summary,
    result.card.body,
    result.card.sourceExcerpt || "",
    result.card.sourceDescription,
    result.card.domainTag,
  ].join("\n").toLowerCase();
}

export function directAnswerQuestionText(result: RetrievalResult) {
  return (
    result.question ||
    (result.originalQueryTerms || result.queryTerms || []).join("")
  ).toLowerCase();
}

export function splitEvidenceSections(body: string): string[] {
  return body
    .split(/(?=\n?\s*\u3010[^\u3011]+\u3011)|(?=\n\s*#{1,6}\s+)/)
    .map((section) => section.trim().toLowerCase())
    .filter(Boolean);
}
