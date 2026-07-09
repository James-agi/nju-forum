import type { RetrievalResult } from "@/lib/knowledge/types-internal";
import { isSpec } from "@/lib/knowledge/scoring";
import { attachEvidenceChunks } from "@/lib/knowledge/chunk-retrieval";
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
const LOCATION_SENSITIVE_SERVICE_TERMS = [
  "洗衣",
  "洗衣店",
  "理发",
  "理发店",
  "剪头发",
  "发店",
  "打印",
  "打印店",
  "快递",
  "外卖",
  "食堂",
  "修车",
  "自行车",
  "修理",
  "修理铺",
  "浴室",
  "洗浴",
  "教超",
  "教育超市",
  "便利店",
  "商铺",
  "日用品",
  "生活用品",
  "日化用品",
];
const MIN_LIMITED_BROAD_SCORE = 3;
const MIN_DIRECT_TITLE_SCORE = 6;
const NON_EVIDENCE_TERMS = new Set([
  "南大",
  "南京大学",
  "南大有",
  "南京",
  "大学",
  "学校",
  "专业",
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
  "某门课",
  "谁教",
  "自己",
  "通常",
  "解决",
  "学生",
  "已经",
  "普通",
  "不会",
  "麻烦",
  "消息",
  "这边",
  "这事",
  "事情",
  "先别",
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
  "有点",
  "弱弱",
  "一句",
  "经验",
  "不确定",
  "确定",
  "求稳",
  "说法",
  "谢谢",
]);
const ORIGINAL_ANCHOR_STOP_TERMS = new Set([
  "校外",
  "校外人员",
  "人员",
  "入馆",
  "进馆",
  "访问",
  "进入",
  "能不能",
  "可不可以",
  "是不是",
  "怎么办",
  "去哪",
  "哪里",
  "哪儿",
]);
const DIRECT_ANSWER_QUERY_PATTERNS = [
  /能不能|能否|可不可以|可以.{0,8}吗|是否|是不是|有没有|有.{0,12}吗/,
  /几点|开门|关门|闭馆|开馆|营业|营业时间|开放时间/,
  /哪里.{0,8}(吃饭|吃点|吃的|餐饮|食堂|餐厅|夜宵)|晚上|夜间|十点后/,
  /允许|让不让|能进|进馆|入馆|进校|入校|进入.{0,8}图书馆|进.{0,8}图书馆/,
  /今年|当前|现在|还剩|余量|缺学生|还缺|稳不稳/,
];
const DIRECT_ANSWER_ANCHOR_TERMS = new Set([
  "校外",
  "校外人员",
  "访客",
  "外来人员",
  "人员",
  "入馆",
  "进馆",
  "进校",
  "入校",
  "进入",
  "访问",
  "允许",
  "开放",
  "几点",
  "时间",
  "开放时间",
  "营业时间",
  "关门",
  "开门",
  "闭馆",
  "开馆",
  "营业",
  "缺学生",
  "还缺",
  "名额",
  "余量",
  "还剩",
  "吃饭",
  "餐饮",
  "食堂",
  "饭点",
  "夜宵",
  "老师",
  "谁教",
  "授课老师",
  "任课老师",
]);
const DIRECT_ANSWER_RELATED_TERMS: Record<string, string[]> = {
  "校外": ["校外", "校外人员", "访客", "外来人员"],
  "校外人员": ["校外", "校外人员", "访客", "外来人员"],
  "人员": ["人员", "校外人员", "访客", "外来人员"],
  "入馆": ["入馆", "进馆", "进入图书馆", "进图书馆"],
  "进馆": ["入馆", "进馆", "进入图书馆", "进图书馆"],
  "进入": ["入馆", "进馆", "进入图书馆", "进图书馆", "进入"],
  "时间": ["开放时间", "营业时间", "关门时间", "开门时间", "闭馆时间", "开馆时间"],
  "几点": ["开放时间", "营业时间", "关门时间", "开门时间", "闭馆时间", "开馆时间"],
  "关门": ["关门时间", "闭馆时间", "几点关门", "几点闭馆"],
  "开门": ["开门时间", "开馆时间", "几点开门", "几点开馆"],
  "闭馆": ["关门时间", "闭馆时间", "几点关门", "几点闭馆"],
  "开馆": ["开门时间", "开馆时间", "几点开门", "几点开馆"],
  "营业": ["营业", "营业时间", "开放时间", "开门", "关门"],
  "营业时间": ["营业", "营业时间", "开放时间", "开门", "关门"],
  "开放时间": ["时间", "开放时间", "营业时间", "开门", "关门", "闭馆", "开馆"],
  "名额状态": ["缺学生", "还缺学生", "招生名额", "剩余名额", "名额余量", "还剩几个", "余量"],
  "餐饮供给": ["吃饭", "餐饮", "食堂", "餐厅", "夜宵", "饭点", "外卖", "营业时间", "开放时间"],
  "授课教师": ["谁教", "教师名单", "课程教师名单", "主讲教师", "开课教师", "任课教师名单", "授课教师名单"],
  "保研要求": ["保研要求", "保研条件", "保研资格", "推免要求", "推免条件", "推免资格"],
  "图书馆开放时间": ["图书馆开放时间", "图书馆营业时间", "图书馆关门", "图书馆闭馆", "几点闭馆", "几点关门"],
  "导师名额状态": ["导师还缺学生", "导师缺学生", "导师招生名额", "导师剩余名额", "导师名额余量"],
};
const TRANSFER_QUESTION_TERMS = ["转专业", "换专业", "跨大类准入"];
const TRANSFER_EVIDENCE_TERMS = [
  "转专业",
  "换专业",
  "转入",
  "转出",
  "准入",
  "跨大类",
  "大一转",
  "大二转",
  "转专业机会",
  "转专业限制",
];
const DIRECT_TITLE_ANCHORS = new Set([
  "缴费",
  "学费",
  "缓考",
  "体育",
  "体育课",
  "选课",
  "初选",
  "退补选",
  "培养方案",
  "通识课",
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
  "挂科",
  "不及格",
  "补考",
  "重修",
  "学业预警",
  "拔尖班",
  "拔尖",
  "退出",
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
  "同代码",
  "南京校区",
  "课程体系",
  "退课",
  "教超",
  "教育超市",
  "便利店",
  "商铺",
  "日用品",
  "生活用品",
  "日化用品",
  "因病",
  "发烧",
  "修车",
  "进组",
  "图书馆",
  "校医院",
  "医保",
  "宿舍",
  "校园卡",
  "饭卡",
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
  if (queryLocations.some((term) => !matched.has(term))) return true;

  const summary = result.card.summary.toLowerCase();
  const summaryLocations = LOCATION_TERMS.filter((term) => includesReliableTerm(summary, term));
  if (summaryLocations.length === 0) return false;

  return !summaryLocations.some((term) => queryLocations.includes(term));
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

function hasQueryLocation(result: RetrievalResult) {
  return (result.queryTerms || []).some((term) => LOCATION_TERMS.includes(term));
}

function isLocationSensitiveServiceQuery(result: RetrievalResult) {
  return (result.queryTerms || []).some((term) => LOCATION_SENSITIVE_SERVICE_TERMS.includes(term));
}

function cardCoversLocationSensitiveService(result: RetrievalResult) {
  const text = evidenceSearchText(result);
  return LOCATION_SENSITIVE_SERVICE_TERMS.some((term) => includesReliableTerm(text, term));
}

function hasLocationInSummary(result: RetrievalResult) {
  const summary = result.card.summary.toLowerCase();
  return LOCATION_TERMS.some((term) => includesReliableTerm(summary, term));
}

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

  return LOCATION_TERMS.find((term) => terms.includes(term) || question.includes(term.toLowerCase())) || null;
}

function isCampusOverviewQuery(result: RetrievalResult) {
  return Boolean(queryCampusOverviewLocation(result));
}

function cardCoversCampusOverview(result: RetrievalResult) {
  const location = queryCampusOverviewLocation(result);
  if (!location) return false;
  if (result.card.verificationStatus !== "VERIFIED") return false;
  if (result.score < MIN_DIRECT_TITLE_SCORE) return false;

  const text = evidenceSearchText(result);
  if (!includesReliableTerm(text, location)) return false;

  return CAMPUS_OVERVIEW_SUPPORT_TERMS.some((term) => includesReliableTerm(text, term));
}

function isOriginalCoreAnchor(term: string) {
  const normalized = term.toLowerCase();
  if (LOCATION_TERMS.includes(term)) return false;
  if (NON_EVIDENCE_TERMS.has(normalized) || ORIGINAL_ANCHOR_STOP_TERMS.has(normalized)) return false;
  return isSpec(normalized);
}

function missesOriginalCoreAnchor(result: RetrievalResult) {
  const originalCoreAnchors = (result.originalQueryTerms || []).filter(isOriginalCoreAnchor);
  if (originalCoreAnchors.length === 0) return false;

  const matched = new Set(result.matchedTerms.map((term) => term.toLowerCase()));
  return !originalCoreAnchors.some((term) => matched.has(term.toLowerCase()));
}

function uniqueTerms(terms: string[]) {
  return Array.from(new Set(terms.map((term) => term.toLowerCase())));
}

function evidenceSearchText(result: RetrievalResult) {
  return [
    result.card.summary,
    result.card.body,
    result.card.sourceExcerpt || "",
    result.card.sourceDescription,
    result.card.domainTag,
  ].join("\n").toLowerCase();
}

function directAnswerQuestionText(result: RetrievalResult) {
  return (
    result.question ||
    (result.originalQueryTerms || result.queryTerms || []).join("")
  ).toLowerCase();
}

function isDirectAnswerAnchor(term: string) {
  const normalized = term.toLowerCase();
  return DIRECT_ANSWER_ANCHOR_TERMS.has(normalized) || isDomainAnchor(normalized);
}

function requiredDirectAnswerAnchors(question: string) {
  const required: string[] = [];
  if (/校外|校外人员|访客|外来人员/.test(question)) {
    required.push("校外");
  }
  if (/入馆|进馆|进入.{0,8}图书馆|进.{0,8}图书馆/.test(question)) {
    required.push("入馆");
  }
  if (/图书馆/.test(question) && /几点|关门|闭馆|开门|开馆|营业|营业时间|开放时间/.test(question)) {
    required.push("图书馆开放时间");
  }
  if (/关门|闭馆/.test(question)) {
    required.push("关门");
  } else if (/开门|开馆/.test(question)) {
    required.push("开门");
  } else if (/几点|营业|营业时间|开放时间/.test(question)) {
    required.push("时间");
  }
  if (/导师/.test(question) && /缺学生|还缺|还剩|余量|名额还剩|名额/.test(question)) {
    required.push("导师名额状态");
  } else if (/缺学生|还缺|还剩|余量|名额还剩/.test(question)) {
    required.push("名额状态");
  }
  if (/保研|推免/.test(question) && /要求|条件|资格|门槛/.test(question)) {
    required.push("保研要求");
  }
  if (/吃饭|吃点|吃什么|吃的|餐饮|食堂|餐厅|夜宵/.test(question)) {
    required.push("餐饮供给");
  }
  if (/谁教|哪位老师|哪个老师|授课老师|任课老师|具体.{0,6}老师/.test(question)) {
    required.push("授课教师");
  }
  return required;
}

function directAnswerAnchors(result: RetrievalResult) {
  const baseTerms = result.originalQueryTerms?.length ? result.originalQueryTerms : result.queryTerms || [];
  const question = directAnswerQuestionText(result);
  return uniqueTerms([
    ...baseTerms.filter(isDirectAnswerAnchor),
    ...requiredDirectAnswerAnchors(question),
  ]);
}

function anchorEvidenceTerms(anchor: string) {
  return DIRECT_ANSWER_RELATED_TERMS[anchor] || [anchor];
}

function evidenceCoversAnchor(text: string, anchor: string) {
  return anchorEvidenceTerms(anchor).some((term) => includesReliableTerm(text, term));
}

function requiresDirectAnswerability(result: RetrievalResult) {
  const question = directAnswerQuestionText(result);
  if (requiredDirectAnswerAnchors(question).length > 0) return true;
  if (!DIRECT_ANSWER_QUERY_PATTERNS.some((pattern) => pattern.test(question))) return false;
  return directAnswerAnchors(result).length >= 2;
}

function missesDirectAnswerability(result: RetrievalResult) {
  if (!requiresDirectAnswerability(result)) return false;

  const anchors = directAnswerAnchors(result);
  const text = evidenceSearchText(result);
  const required = requiredDirectAnswerAnchors(directAnswerQuestionText(result));

  if (required.some((anchor) => !evidenceCoversAnchor(text, anchor))) return true;

  const coveredCount = anchors.filter((anchor) => evidenceCoversAnchor(text, anchor)).length;
  return coveredCount < Math.min(2, anchors.length);
}

function isTransferQuestion(result: RetrievalResult) {
  const question = directAnswerQuestionText(result);
  const terms = result.originalQueryTerms || result.queryTerms || [];
  return TRANSFER_QUESTION_TERMS.some((term) => (
    question.includes(term.toLowerCase()) ||
    terms.some((queryTerm) => queryTerm.toLowerCase() === term.toLowerCase())
  ));
}

function missesTransferQuestionAction(result: RetrievalResult) {
  if (!isTransferQuestion(result)) return false;
  const text = evidenceSearchText(result);
  return !TRANSFER_EVIDENCE_TERMS.some((term) => includesReliableTerm(text, term));
}

function isLocationServiceWithoutQueryLocation(results: RetrievalResult[]) {
  return results.some((result) => (
    isLocationSensitiveServiceQuery(result) && !hasQueryLocation(result)
  ));
}

function prioritizeLocationServiceEvidence(results: RetrievalResult[]) {
  if (!isLocationServiceWithoutQueryLocation(results)) return results;

  const neutral = results.filter((result) => !hasLocationInSummary(result));
  const located = results.filter(hasLocationInSummary);
  return [...neutral, ...located];
}

function isCampusOverviewResults(results: RetrievalResult[]) {
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

function prioritizeCampusOverviewEvidence(results: RetrievalResult[]) {
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

function hasLimitedBroadEvidence(result: RetrievalResult) {
  if (result.card.verificationStatus !== "VERIFIED") return false;
  if (missesRequiredLocationConstraint(result)) return false;
  if (missesOriginalCoreAnchor(result)) return false;
  if (missesTransferQuestionAction(result)) return false;
  if (
    missesDirectAnswerability(result) &&
    !(isLocationSensitiveServiceQuery(result) && cardCoversLocationSensitiveService(result))
  ) {
    return false;
  }
  if (!isLimitedDetailQuery(result)) return false;
  if (result.score < MIN_LIMITED_BROAD_SCORE) return false;
  return result.matchedTerms.some(isDomainAnchor);
}

function hasUsableEvidence(result: RetrievalResult) {
  return hasCampusOverviewEvidence(result) || hasStrongEvidence(result) || hasDirectTitleEvidence(result) || hasLimitedBroadEvidence(result);
}

function hasCampusOverviewEvidence(result: RetrievalResult) {
  if (!isCampusOverviewQuery(result)) return false;
  if (missesRequiredLocationConstraint(result)) return false;
  if (missesTransferQuestionAction(result)) return false;
  if (missesDirectAnswerability(result)) return false;
  return cardCoversCampusOverview(result);
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
  if (missesOriginalCoreAnchor(result)) return false;
  if (missesTransferQuestionAction(result)) return false;
  if (missesDirectAnswerability(result)) return false;

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
  if (missesOriginalCoreAnchor(result)) return false;
  if (missesTransferQuestionAction(result)) return false;
  if (missesDirectAnswerability(result)) return false;
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

  const preferredStrongActive = prioritizeCampusOverviewEvidence(prioritizeLocationServiceEvidence(strongActive));
  const topScore = preferredStrongActive[0]?.score ?? 0;
  const minUsableScore = isCampusOverviewResults(preferredStrongActive)
    ? MIN_DIRECT_TITLE_SCORE
    : isLocationServiceWithoutQueryLocation(preferredStrongActive)
    ? MIN_DIRECT_TITLE_SCORE
    : Math.max(MIN_SINGLE_ANCHOR_SCORE, topScore - EVIDENCE_SCORE_DIFF);
  const maxUsable = isCampusOverviewResults(preferredStrongActive)
    ? Math.max(EVIDENCE_MAX_USABLE, 4)
    : EVIDENCE_MAX_USABLE;
  const usable = preferredStrongActive
    .filter((r, index) => (index === 0 || r.score >= minUsableScore) && hasUsableEvidence(r))
    .slice(0, maxUsable);

  if (usable.every((r) => r.card.verificationStatus === "NEEDS_REVIEW")) {
    return { sufficient: false, reason: "NEEDS_REVIEW", cards: [] };
  }

  return { sufficient: true, reason: "PREFILTER_PASSED", cards: usable.map((result) => attachEvidenceChunks(result)) };
}
