import { GENERIC } from "@/lib/knowledge/lexicon";
import { tokenize } from "@/lib/knowledge/tokenizer";
import type { RetrievalResult } from "@/lib/knowledge/types-internal";

export interface GroundingCitation {
  cardId: string;
  claimText: string;
}

const CONSERVATIVE_META_PATTERNS = [
  /(?:无法|不能|暂时不能)确认/,
  /(?:证据|卡片|信息).*(?:不足|未覆盖|没有覆盖)/,
  /以.*(?:通知|系统|页面|官网).*为准/,
];
const CONSERVATIVE_QUALIFIER_PREFIX = /^(?:目前|当前)?(?:只能|仅能)确认/;

function normalizeForComparison(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function numericFacts(text: string) {
  const normalized = text.normalize("NFKC");
  return normalized.match(
    /\d+(?:[.:/\-]\d+)*(?:\s*(?:%|％|个|次|遍|分|学分|小时|分钟|天|周|月|年|级|元|点|路|号))?|[零〇一二两三四五六七八九十百千万亿]+(?:个|次|遍|分|学分|小时|分钟|天|周|月|年|级|元|点|路|号)/g,
  ) ?? [];
}

function splitStatements(text: string) {
  return text
    .split(/[\n。！？!?；;，,]+/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length >= 2);
}

function evidenceTextForResult(result: RetrievalResult) {
  if (result.evidenceChunks?.length) {
    return [
      result.card.summary,
      ...result.evidenceChunks.flatMap((chunk) => [chunk.sectionTitle || "", chunk.text]),
    ].join("\n");
  }

  return [
    result.card.summary,
    result.card.body,
    result.card.sourceExcerpt || "",
  ].join("\n");
}

async function substantiveTerms(text: string) {
  const terms = await tokenize(text);
  return Array.from(new Set(terms))
    .filter((term) => term.length >= 2)
    .filter((term) => !GENERIC.has(term))
    .filter((term) => !/^\d+$/.test(term));
}

async function statementIsSupported(
  statement: string,
  supportTexts: string[],
  allowConservativeMeta: boolean,
) {
  if (allowConservativeMeta && CONSERVATIVE_META_PATTERNS.some((pattern) => pattern.test(statement))) {
    return true;
  }

  const substantiveStatement = allowConservativeMeta
    ? statement.replace(CONSERVATIVE_QUALIFIER_PREFIX, "")
    : statement;

  const normalizedSupport = supportTexts.map(normalizeForComparison);
  const supportedNumericFacts = new Set(
    supportTexts.flatMap(numericFacts).map(normalizeForComparison),
  );
  if (numericFacts(statement).some((fact) => !supportedNumericFacts.has(normalizeForComparison(fact)))) {
    return false;
  }

  const terms = await substantiveTerms(substantiveStatement);
  if (terms.length === 0) return false;

  const supportedTerms = terms.filter((term) => {
    const normalizedTerm = normalizeForComparison(term);
    return normalizedSupport.some((support) => support.includes(normalizedTerm));
  });
  const requiredMatches = Math.max(1, Math.ceil(terms.length * 0.7));

  return supportedTerms.length >= requiredMatches;
}

export async function isAnswerGrounded(params: {
  answerText: string;
  structuredClaims: string[];
  citations: GroundingCitation[];
  evidence: RetrievalResult[];
}) {
  const evidenceByCardId = new Map(
    params.evidence.map((result) => [result.card.id, evidenceTextForResult(result)]),
  );

  for (const citation of params.citations) {
    const cardEvidence = evidenceByCardId.get(citation.cardId);
    if (!cardEvidence) return false;
    for (const claimStatement of splitStatements(citation.claimText)) {
      if (!await statementIsSupported(claimStatement, [cardEvidence], false)) return false;
    }
  }

  const citationClaims = params.citations.map((citation) => citation.claimText);
  const answerStatements = [params.answerText, ...params.structuredClaims]
    .flatMap(splitStatements);

  for (const statement of answerStatements) {
    if (!await statementIsSupported(statement, citationClaims, true)) return false;
  }

  return true;
}
