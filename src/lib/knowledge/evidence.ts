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

const FALSE_POSITIVE_PREFIXES: Record<string, string[]> = {
  "\u62a5\u5230": ["\u7533"],
};

const LOCATION_TERMS = ["鼓楼", "仙林", "浦口", "苏州"];
const MIN_LIMITED_BROAD_SCORE = 3;
const MIN_DIRECT_TITLE_SCORE = 6;
const NON_EVIDENCE_TERMS = new Set([
  "南大",
  "南京大学",
  "南大有",
  "南京",
  "大学",
  "学校",
  "校区",
  "校园",
  "哪里",
  "哪儿",
  "哪个",
  "哪些",
  "这门",
  "课到",
  "附近",
  "一般",
  "到底",
  "老师",
  "收到",
  "不知",
  "不知道",
  "今年",
  "今天",
  "现在",
  "当前",
  "有没有",
  "没有",
  "怎么",
  "如何",
  "什么",
  "具体",
  "现在",
  "今天",
  "今年",
  "相关",
  "问题",
]);
const DIRECT_TITLE_ANCHORS = new Set([
  "缴费",
  "学费",
  "缓考",
  "体育",
  "体育课",
  "校园网",
  "vpn",
  "eduroam",
  "校车",
  "班车",
  "大创",
  "创新项目",
  "导师",
  "课题",
  "教材",
  "二手书",
  "南哪助手",
  "投稿",
  "暑研",
  "分流志愿",
  "保研课",
  "新生群",
  "学生会",
  "洗衣",
  "洗衣店",
  "理发",
  "理发店",
  "剪头发",
  "发店",
  "快递",
  "外卖",
  "食堂",
  "打印",
  "打印店",
  "彩色",
  "自行车",
  "修理",
  "修理铺",
  "渠道",
  "床",
  "床位",
  "床尺寸",
  "借书",
  "还书",
  "借阅",
  "跨校区借书",
  "跨校区借阅",
  "信息卡",
  "校园信息卡",
  "宽带卡",
  "宽带信息卡",
  "成绩更正",
  "登错",
  "录错",
  "申诉",
  "拔尖班",
  "面试",
  "求助",
  "部门",
  "网上办事大厅",
  "常用服务",
  "换乘",
  "院系",
  "在哪个校区",
  "哪个校区",
  "校区归属",
  "计算机",
  "计算机类",
]);
const LIMITED_DETAIL_PATTERNS = [
  /今天|明天|今晚|现在|当前|实时|最新|今年|本学期|下学期/,
  /具体|精确|最低|名额|余量|余票|还有没有|有没有票|有没有号/,
  /几点|开门|关门|营业|开放时间|关闭时间/,
  /余额|多少钱|价格|哪位老师/,
];

function isFalsePositiveTermMatch(text: string, term: string, index: number) {
  const prefixes = FALSE_POSITIVE_PREFIXES[term];
  if (!prefixes) return false;
  const before = index > 0 ? text[index - 1] : "";
  return prefixes.includes(before);
}

function includesReliableTerm(text: string, term: string) {
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

function missesRequiredLocationConstraint(result: RetrievalResult) {
  const queryLocations = (result.queryTerms || []).filter((term) => LOCATION_TERMS.includes(term));
  if (queryLocations.length === 0) return false;

  const matched = new Set(result.matchedTerms);
  return queryLocations.some((term) => !matched.has(term));
}

function isLimitedDetailQuery(result: RetrievalResult) {
  return (result.queryTerms || []).some((term) => LIMITED_DETAIL_PATTERNS.some((pattern) => pattern.test(term)));
}

function isDomainAnchor(term: string) {
  const normalized = term.toLowerCase();
  return !LOCATION_TERMS.includes(term) && !NON_EVIDENCE_TERMS.has(normalized) && isSpec(normalized);
}

function isDirectTitleAnchor(term: string) {
  return DIRECT_TITLE_ANCHORS.has(term.toLowerCase());
}

function hasLimitedBroadEvidence(result: RetrievalResult) {
  if (result.card.verificationStatus !== "VERIFIED") return false;
  if (missesRequiredLocationConstraint(result)) return false;
  if (!isLimitedDetailQuery(result)) return false;
  if (result.score < MIN_LIMITED_BROAD_SCORE) return false;
  return result.matchedTerms.some(isDomainAnchor);
}

function hasUsableEvidence(result: RetrievalResult) {
  return hasStrongEvidence(result) || hasDirectTitleEvidence(result) || hasLimitedBroadEvidence(result);
}

function splitEvidenceSections(body: string): string[] {
  return body
    .split(/(?=\n?\s*\u3010[^\u3011]+\u3011)|(?=\n\s*#{1,6}\s+)/)
    .map((section) => section.trim().toLowerCase())
    .filter(Boolean);
}

function hasSectionEvidence(result: RetrievalResult, contentStrongTerms: string[]) {
  if (contentStrongTerms.length === 0) return false;

  const summary = result.card.summary.toLowerCase();
  const summaryTerms = contentStrongTerms.filter((term) => {
    return includesReliableTerm(summary, term) || (term.length >= 3 && includesReliableTerm(summary, term.slice(0, 2)));
  });
  if (summaryTerms.length === 0) return false;

  return splitEvidenceSections(result.card.body).some((section) => {
    const sectionTerms = contentStrongTerms.filter((term) => includesReliableTerm(section, term));
    if (sectionTerms.length === 0) return false;

    const combinedTerms = new Set([...summaryTerms, ...sectionTerms]);
    if (summaryTerms.some((term) => term.length >= 3 && sectionTerms.includes(term))) return true;
    return combinedTerms.size >= MIN_STRONG_TERM_COUNT;
  });
}

function hasStrongEvidence(result: RetrievalResult) {
  if (missesRequiredLocationConstraint(result)) return false;

  const summary = result.card.summary.toLowerCase();
  const body = result.card.body.toLowerCase();
  const strongTerms = result.matchedTerms.filter(isDomainAnchor);
  const contentStrongTerms = strongTerms.filter((term) => {
    return includesReliableTerm(summary, term) || includesReliableTerm(body, term);
  });

  const hasReinforcedContentAnchor = contentStrongTerms.some((term) => {
    return term.length >= 3 && includesReliableTerm(summary, term) && includesReliableTerm(body, term);
  });
  const hasMultipleContentAnchors = contentStrongTerms.length >= MIN_STRONG_TERM_COUNT;

  if (hasMultipleContentAnchors && result.score >= MIN_SUFFICIENT_SCORE) return true;
  if (hasReinforcedContentAnchor && result.score >= MIN_SINGLE_ANCHOR_SCORE) return true;
  if (result.score >= MIN_DIRECT_TITLE_SCORE && hasSectionEvidence(result, contentStrongTerms)) return true;
  return false;
}

function hasDirectTitleEvidence(result: RetrievalResult) {
  if (result.card.verificationStatus !== "VERIFIED") return false;
  if (missesRequiredLocationConstraint(result)) return false;
  if (result.score < MIN_DIRECT_TITLE_SCORE) return false;

  const summary = result.card.summary.toLowerCase();
  const body = result.card.body.toLowerCase();
  return result.matchedTerms.some((term) => {
    if (!isDirectTitleAnchor(term)) return false;
    if (!includesReliableTerm(summary, term)) return false;
    if (term.length >= 3 && result.score >= MIN_DIRECT_TITLE_SCORE) return true;
    return includesReliableTerm(body, term) || result.score >= MIN_SINGLE_ANCHOR_SCORE;
  });
}

export function evaluateEvidence(results: RetrievalResult[]): EvidenceEvaluation {
  if (results.length === 0) return { sufficient: false, reason: "EMPTY", cards: [] };

  const active = results
    .filter((r) => !r.card.archivedAt)
    .sort((a, b) => b.score - a.score || b.card.updatedAt.getTime() - a.card.updatedAt.getTime());
  if (active.length === 0) return { sufficient: false, reason: "ARCHIVED", cards: [] };

  const strongActive = active.filter(hasUsableEvidence);
  if (strongActive.length === 0) {
    return { sufficient: false, reason: "UNRELATED", cards: [] };
  }

  const topScore = strongActive[0]?.score ?? 0;
  const minUsableScore = Math.max(MIN_SINGLE_ANCHOR_SCORE, topScore - EVIDENCE_SCORE_DIFF);
  const usable = strongActive
    .filter((r, index) => (index === 0 || r.score >= minUsableScore) && hasUsableEvidence(r))
    .slice(0, EVIDENCE_MAX_USABLE);

  if (usable.every((r) => r.card.verificationStatus === "NEEDS_REVIEW")) {
    return { sufficient: false, reason: "NEEDS_REVIEW", cards: [] };
  }

  return { sufficient: true, reason: "PREFILTER_PASSED", cards: usable };
}
