import type { RetrievalResult } from "@/lib/knowledge/types-internal";
import { isSpec } from "@/lib/knowledge/scoring";
import {
  MIN_SUFFICIENT_SCORE,
  MIN_STRONG_TERM_COUNT,
  MIN_SINGLE_ANCHOR_SCORE,
  EVIDENCE_MAX_USABLE,
  EVIDENCE_SCORE_DIFF,
} from "@/lib/knowledge/config";

export interface EvidenceEvaluation {
  sufficient: boolean;
  reason?: "EMPTY" | "ARCHIVED" | "UNRELATED" | "NEEDS_REVIEW" | "PREFILTER_PASSED";
  cards: RetrievalResult[];
}

function hasStrongEvidence(result: RetrievalResult) {
  const summary = result.card.summary.toLowerCase();
  const body = result.card.body.toLowerCase();
  const strongTerms = result.matchedTerms.filter(isSpec);
  const contentStrongTerms = strongTerms.filter((term) => {
    const normalized = term.toLowerCase();
    return summary.includes(normalized) || body.includes(normalized);
  });

  const hasReinforcedContentAnchor = contentStrongTerms.some((term) => {
    const normalized = term.toLowerCase();
    return term.length >= 3 && summary.includes(normalized) && body.includes(normalized);
  });
  const hasMultipleContentAnchors = contentStrongTerms.length >= MIN_STRONG_TERM_COUNT;

  if (hasMultipleContentAnchors) return result.score >= MIN_SUFFICIENT_SCORE;
  if (hasReinforcedContentAnchor) return result.score >= MIN_SINGLE_ANCHOR_SCORE;
  return false;
}

export function evaluateEvidence(results: RetrievalResult[]): EvidenceEvaluation {
  if (results.length === 0) return { sufficient: false, reason: "EMPTY", cards: [] };

  const active = results
    .filter((r) => !r.card.archivedAt)
    .sort((a, b) => b.score - a.score || b.card.updatedAt.getTime() - a.card.updatedAt.getTime());
  if (active.length === 0) return { sufficient: false, reason: "ARCHIVED", cards: [] };

  const topScore = active[0]?.score ?? 0;
  if (!hasStrongEvidence(active[0])) {
    return { sufficient: false, reason: "UNRELATED", cards: [] };
  }

  const usable = active
    .filter((r) => r.score >= Math.max(MIN_SINGLE_ANCHOR_SCORE, topScore - EVIDENCE_SCORE_DIFF) && hasStrongEvidence(r))
    .slice(0, EVIDENCE_MAX_USABLE);

  if (usable.every((r) => r.card.verificationStatus === "NEEDS_REVIEW")) {
    return { sufficient: false, reason: "NEEDS_REVIEW", cards: [] };
  }

  return { sufficient: true, reason: "PREFILTER_PASSED", cards: usable };
}
