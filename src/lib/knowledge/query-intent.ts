export const CAMPUS_TERMS = ["鼓楼", "仙林", "浦口", "苏州"] as const;

export interface ServiceTopic {
  id: string;
  label: string;
  queryTerms: readonly string[];
  evidenceTerms: readonly string[];
}

export const SERVICE_TOPICS: readonly ServiceTopic[] = [
  {
    id: "takeout",
    label: "外卖",
    queryTerms: ["外卖", "点外卖", "外卖柜", "送到宿舍", "送到楼下"],
    evidenceTerms: ["外卖", "点外卖", "外卖柜", "送到", "配送"],
  },
  {
    id: "food",
    label: "食堂/餐饮",
    queryTerms: ["食堂", "餐厅", "餐饮", "吃饭", "吃点", "吃什么", "吃的", "觅食", "美食", "夜宵"],
    evidenceTerms: ["食堂", "餐厅", "餐饮", "吃饭", "饭点", "夜宵", "窗口", "菜品"],
  },
  {
    id: "laundry_shop",
    label: "洗衣店",
    queryTerms: ["洗衣店", "干洗", "洗鞋", "不想自己洗"],
    evidenceTerms: ["洗衣店", "干洗", "洗鞋", "洗衣服务"],
  },
  {
    id: "laundry",
    label: "洗衣",
    queryTerms: ["洗衣服", "洗衣", "洗衣机", "洗衣房", "衣服堆"],
    evidenceTerms: ["洗衣", "洗衣机", "洗衣房", "公共洗衣", "宿舍洗衣", "扫码"],
  },
  {
    id: "haircut",
    label: "理发",
    queryTerms: ["理发", "理发店", "剪头发", "发店", "头发太长", "去哪剪"],
    evidenceTerms: ["理发", "理发店", "剪头发", "发店"],
  },
  {
    id: "delivery",
    label: "快递",
    queryTerms: ["快递", "快递站", "菜鸟", "菜鸟驿站", "邮寄", "收货地址"],
    evidenceTerms: ["快递", "快递站", "菜鸟", "菜鸟驿站", "邮寄", "收货地址"],
  },
  {
    id: "printing",
    label: "打印",
    queryTerms: ["打印", "打印店", "文印", "复印", "证件照"],
    evidenceTerms: ["打印", "打印店", "文印", "复印", "证件照"],
  },
  {
    id: "repair",
    label: "修车/修理",
    queryTerms: ["修车", "自行车", "电动车", "修理", "修理铺", "打气"],
    evidenceTerms: ["修车", "自行车", "电动车", "修理", "修理铺", "打气"],
  },
  {
    id: "shops",
    label: "商铺/日用品",
    queryTerms: ["商铺", "教超", "教育超市", "便利店", "日用品", "生活用品", "日化用品", "买东西"],
    evidenceTerms: ["商铺", "教超", "教育超市", "便利店", "日用品", "生活用品", "日化用品"],
  },
  {
    id: "bath",
    label: "浴室/洗浴",
    queryTerms: ["浴室", "洗浴", "洗澡", "淋浴"],
    evidenceTerms: ["浴室", "洗浴", "洗澡", "淋浴"],
  },
  {
    id: "housing",
    label: "宿舍",
    queryTerms: ["宿舍", "床位", "床尺寸", "门禁", "用电"],
    evidenceTerms: ["宿舍", "床位", "床尺寸", "门禁", "用电", "入住"],
  },
  {
    id: "transport",
    label: "交通/通勤",
    queryTerms: ["交通", "通勤", "地铁", "公交", "班车", "校车", "路线", "换乘"],
    evidenceTerms: ["交通", "通勤", "地铁", "公交", "班车", "校车", "路线", "换乘"],
  },
];

export const CROSS_CAMPUS_TERMS = [
  "所有校区",
  "各校区",
  "全校区",
  "每个校区",
  "不同校区",
  "校区汇总",
  "校区对比",
  "汇总",
  "对比",
  "分别",
] as const;

function normalize(text: string) {
  return text.toLowerCase();
}

export function includesIntentTerm(text: string, term: string) {
  return normalize(text).includes(normalize(term));
}

export function locationsInText(text: string) {
  return CAMPUS_TERMS.filter((campus) => includesIntentTerm(text, campus));
}

function firstTopicInText(text: string) {
  return SERVICE_TOPICS.find((topic) =>
    topic.queryTerms.some((term) => includesIntentTerm(text, term)),
  ) || null;
}

export function detectServiceTopic(question: string, terms: readonly string[] = []) {
  const directTopic = firstTopicInText(question);
  if (directTopic) return directTopic;
  return firstTopicInText(terms.join("\n"));
}

export function textCoversServiceTopic(text: string, topic: ServiceTopic) {
  return topic.evidenceTerms.some((term) => includesIntentTerm(text, term));
}

export function titleLooksLikeServiceContainer(text: string) {
  return /生活服务|商铺|校内外|购物/.test(text);
}

export function textCoversServiceTopicAsMain(titleText: string, bodyText: string, topic: ServiceTopic) {
  const titleCoversTopic = textCoversServiceTopic(titleText, topic);
  const containerBodyCoversTopic = titleLooksLikeServiceContainer(titleText) &&
    textCoversServiceTopic(bodyText, topic);
  return titleCoversTopic || containerBodyCoversTopic;
}

export function textHasCrossCampusCoverage(titleText: string, fullText: string) {
  const titleCampuses = locationsInText(titleText);
  const allCampuses = locationsInText(fullText);
  return titleCampuses.length > 0 || allCampuses.length >= 2;
}

export function hasCrossCampusCue(question: string, terms: readonly string[] = []) {
  const text = `${question}\n${terms.join("\n")}`;
  if (CROSS_CAMPUS_TERMS.some((term) => includesIntentTerm(text, term))) return true;
  return /(?:所有|各|全|每个|不同).{0,4}校区|校区.{0,4}(汇总|对比)|分别.{0,8}校区/.test(text);
}

export function detectCrossCampusServiceIntent(question: string, terms: readonly string[] = []) {
  const topic = detectServiceTopic(question, terms);
  if (!topic || !hasCrossCampusCue(question, terms)) return null;
  return { topic };
}

export function isRealtimeOperationalStatusQuestion(question: string) {
  const text = normalize(question);
  const hasRealtimeCue = /今天|明天|今晚|现在|当前|实时|此刻/.test(text);
  const hasOperationalCue = /还开|开吗|营业吗|开门吗|开放吗|关了吗|闭馆吗|能不能去|能去吗/.test(text);
  const hasAvailabilityCue =
    /还有|还剩|空位|余量|余票|有没有.{0,8}(座位|空位|名额|号)|能约到|约得到|缺学生|还缺/.test(text);
  const hasPlaceOrService = Boolean(detectServiceTopic(question)) || /图书馆|校医院|体育馆|自习室|教室|座位/.test(text);
  return hasRealtimeCue && (hasOperationalCue || hasAvailabilityCue) && hasPlaceOrService;
}
