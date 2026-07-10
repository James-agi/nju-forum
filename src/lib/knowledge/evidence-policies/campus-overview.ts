import {
  CAMPUS_TERMS,
} from "@/lib/knowledge/query-intent";
import type { RetrievalResult } from "@/lib/knowledge/types-internal";
import {
  directAnswerQuestionText,
  evidenceSearchText,
  includesReliableTerm,
} from "@/lib/knowledge/evidence-text";

const CAMPUS_OVERVIEW_TERMS = ["校区概况", "概况", "介绍", "怎么样", "有什么", "校园生活", "校区交通"];
const CAMPUS_OVERVIEW_SUPPORT_TERMS = [
  "宿舍",
  "食堂",
  "通勤",
  "交通",
  "商铺",
  "快递",
  "体育馆",
  "运动场",
  "自习",
  "生活",
  "服务",
  "校区",
];
const CONCRETE_CAMPUS_FOCUS_TERMS = [
  "宿舍",
  "食堂",
  "餐厅",
  "餐饮",
  "吃饭",
  "吃点",
  "吃什么",
  "吃的",
  "觅食",
  "美食",
  "通勤",
  "交通",
  "地铁",
  "公交",
  "班车",
  "校车",
  "商铺",
  "快递",
  "理发",
  "洗衣",
  "打印",
  "外卖",
  "修车",
  "自行车",
  "浴室",
  "自习",
  "图书馆",
  "校园卡",
  "一卡通",
  "饭卡",
  "校园网",
  "校医院",
  "医保",
];
const CAMPUS_OVERVIEW_FACETS = [
  {
    id: "housing",
    terms: ["宿舍", "床", "床位", "洗澡", "门禁", "用电", "入住"],
  },
  {
    id: "food",
    terms: ["食堂", "餐厅", "餐饮", "吃饭", "吃的", "美食", "觅食"],
  },
  {
    id: "transport",
    terms: ["校区交通", "通勤", "交通", "地铁", "公交", "班车", "校车", "路线"],
  },
  {
    id: "services",
    terms: ["商铺", "快递", "理发", "洗衣", "打印", "便利店", "教超", "教育超市", "修理", "修车"],
  },
  {
    id: "study",
    terms: ["自习", "图书馆", "背诵", "讨论", "教室"],
  },
];

function queryCampusOverviewLocation(result: RetrievalResult) {
  const terms = result.queryTerms || [];
  const question = directAnswerQuestionText(result);
  if (CONCRETE_CAMPUS_FOCUS_TERMS.some((term) => includesReliableTerm(question, term))) {
    return null;
  }

  const hasOverviewIntent = CAMPUS_OVERVIEW_TERMS.some((term) => (
    terms.includes(term) || question.includes(term.toLowerCase())
  ));
  if (!hasOverviewIntent) return null;

  return CAMPUS_TERMS.find((term) => terms.includes(term) || question.includes(term.toLowerCase())) || null;
}

export function isCampusOverviewQuery(result: RetrievalResult) {
  return Boolean(queryCampusOverviewLocation(result));
}

export function cardCoversCampusOverview(result: RetrievalResult, minDirectTitleScore: number) {
  const location = queryCampusOverviewLocation(result);
  if (!location) return false;
  if (result.card.verificationStatus !== "VERIFIED") return false;
  if (result.score < minDirectTitleScore) return false;

  const text = evidenceSearchText(result);
  if (!includesReliableTerm(text, location)) return false;

  return CAMPUS_OVERVIEW_SUPPORT_TERMS.some((term) => includesReliableTerm(text, term));
}

export function isCampusOverviewResults(results: RetrievalResult[]) {
  return results.some(isCampusOverviewQuery);
}

function campusOverviewFacet(result: RetrievalResult) {
  const summary = result.card.summary.toLowerCase();
  const body = result.card.body.toLowerCase();
  const domain = result.card.domainTag.toLowerCase();
  const matched = result.matchedTerms.map((term) => term.toLowerCase());

  let bestId = "other";
  let bestScore = 0;
  let bestPriority = Number.POSITIVE_INFINITY;
  for (const [priority, facet] of CAMPUS_OVERVIEW_FACETS.entries()) {
    const score = facet.terms.reduce((total, term) => {
      const normalized = term.toLowerCase();
      let next = total;
      if (includesReliableTerm(summary, normalized)) next += 4;
      if (matched.includes(normalized)) next += 3;
      if (includesReliableTerm(domain, normalized)) next += 2;
      if (includesReliableTerm(body, normalized)) next += 1;
      return next;
    }, 0);

    if (score > bestScore || (score === bestScore && score > 0 && priority < bestPriority)) {
      bestId = facet.id;
      bestScore = score;
      bestPriority = priority;
    }
  }

  return bestId;
}

export function prioritizeCampusOverviewEvidence(results: RetrievalResult[]) {
  if (!isCampusOverviewResults(results)) return results;

  const domainRank = new Map([
    ["校园生活", 0],
    ["校区交通", 1],
    ["校园办事", 2],
    ["网络系统", 3],
    ["组织资源", 4],
  ]);

  const sorted = [...results].sort((a, b) => {
    const rankA = domainRank.get(a.card.domainTag) ?? 9;
    const rankB = domainRank.get(b.card.domainTag) ?? 9;
    return b.score - a.score || rankA - rankB || b.card.updatedAt.getTime() - a.card.updatedAt.getTime();
  });

  const selected: RetrievalResult[] = [];
  const selectedFacets = new Set<string>();
  for (const result of sorted) {
    const facet = campusOverviewFacet(result);
    if (facet === "other" || selectedFacets.has(facet)) continue;
    selected.push(result);
    selectedFacets.add(facet);
  }

  return [
    ...selected,
    ...sorted.filter((result) => !selected.includes(result)),
  ];
}
