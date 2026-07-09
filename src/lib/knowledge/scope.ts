import { normalizeQuestionText } from "@/lib/knowledge/validation";
import { NJU_SIGNALS } from "@/lib/knowledge/lexicon";

interface ScopeRule {
  code: string;
  label: string;
  keywords: string[];
}

const NON_GOAL_RULES: ScopeRule[] = [
  { code: "TEXTBOOK", label: "教材习题解析", keywords: ["课后题", "例题解析"] },
  { code: "HOMEWORK", label: "作业看板或代做作业", keywords: ["作业", "homework", "帮我写", "代写", "答案是什么"] },
  { code: "TODO", label: "ToDo 或个人计划", keywords: ["todo", "待办", "计划表", "提醒我", "日程安排"] },
  { code: "FORUM_UGC", label: "论坛或 UGC 投稿", keywords: ["发帖", "论坛", "帖子", "投稿", "用户贡献", "ugc"] },
  { code: "PUSH", label: "自动推送", keywords: ["推送", "通知我", "有答案了提醒", "订阅答案"] },
  { code: "WIKI", label: "Wiki 浏览模式", keywords: ["wiki", "知识地图", "浏览所有", "目录模式"] },
  { code: "MEMORY", label: "个性化记忆", keywords: ["记住我", "记住我的", "我的偏好", "个性化记忆", "长期记忆"] },
  { code: "PAYMENT", label: "付费或商业化", keywords: ["付费", "会员", "价格", "商业化", "订阅收费"] },
  { code: "OPEN_CHAT", label: "开放域闲聊", keywords: ["讲个笑话", "陪我聊天", "你是谁", "随便聊聊"] },
];

const GENERAL_OUT_OF_SCOPE_RULES: ScopeRule[] = [
  {
    code: "GENERAL_ENTERTAINMENT",
    label: "泛娱乐推荐",
    keywords: ["电影", "电视剧", "综艺", "小说", "动漫"],
  },
  {
    code: "GENERAL_PROGRAMMING",
    label: "通用编程问答",
    keywords: ["react", "hooks", "javascript", "typescript", "python", "代码怎么写"],
  },
  {
    code: "GENERAL_TRAVEL_SHOPPING",
    label: "通用旅行购物",
    keywords: ["周末去哪玩", "去哪玩", "旅游", "购物", "买什么"],
  },
  {
    code: "GENERAL_CONSUMER_ADVICE",
    label: "通用消费或硬件推荐",
    keywords: ["显卡", "打游戏", "游戏本", "装机", "电脑配置"],
  },
];

const HARD_OUT_OF_SCOPE_RULES: ScopeRule[] = [
  {
    code: "REALTIME_WEATHER",
    label: "实时天气",
    keywords: ["天气", "气温", "下雨", "降雨", "空气质量", "台风"],
  },
  {
    code: "ACADEMIC_MISCONDUCT",
    label: "学术不端或违规请求",
    keywords: [
      "作弊",
      "不被发现",
      "代写",
      "帮我直接完成",
      "直接完成这篇",
      "帮我写论文",
      "帮我直接写完",
      "帮我写完",
      "直接写完",
      "写完课程论文",
    ],
  },
  {
    code: "MEDICAL_ADVICE",
    label: "具体医疗用药建议",
    keywords: ["吃什么药", "用什么药", "该吃药", "该吃什么药", "发烧了该"],
  },
  {
    code: "REALTIME_NEWS",
    label: "实时新闻",
    keywords: ["今天南大有什么新闻", "最新新闻", "实时新闻"],
  },
];

export interface ScopeClassification {
  inScope: boolean;
  code?: string;
  label?: string;
  message?: string;
}

export interface ClarificationDecision {
  needsClarification: boolean;
  message: string;
  suggestions: string[];
}

interface BarePromptRule {
  terms: string[];
  message: string;
  suggestions: (term: string) => string[];
}

const BARE_PROMPT_RULES: BarePromptRule[] = [
  {
    terms: [
      "仙林",
      "仙林校区",
      "鼓楼",
      "鼓楼校区",
      "浦口",
      "浦口校区",
      "苏州",
      "苏州校区",
      "南大",
      "南京大学",
      "学校",
      "校区",
    ],
    message: "这个问题范围太宽了。请补充你想问的具体方面，比如生活服务、食堂、宿舍、交通、办事或课程信息。",
    suggestions: (term) => [
      `${term}食堂有什么？`,
      `${term}宿舍怎么样？`,
      `${term}怎么通勤？`,
      `${term}哪里可以理发或洗衣？`,
    ],
  },
  {
    terms: [
      "人工智能",
      "人工智能专业",
      "人工智能学院",
      "计算机",
      "计算机类",
      "计算机科学与技术",
      "软件工程",
      "电子信息",
      "天文",
      "天文学",
      "数学",
      "物理",
      "化学",
      "生物",
      "地科",
      "地科院",
      "商学院",
      "商院",
      "法学院",
      "法学",
      "新传",
      "新闻传播",
      "信管",
      "医学院",
      "匡院",
      "匡亚明学院",
    ],
    message: "你输入的是专业或院系名，但还没说明想问哪方面。请补充是校区归属、转入限制、课程体验、培养方向还是生活安排。",
    suggestions: (term) => [
      `${term}在哪个校区？`,
      `${term}转专业有什么限制？`,
      `${term}课程体验怎么样？`,
      `${term}培养方向是什么？`,
    ],
  },
  {
    terms: [
      "转专业",
      "保研",
      "军训",
      "宿舍",
      "食堂",
      "校园卡",
      "一卡通",
      "饭卡",
      "挂科",
      "补考",
      "重修",
      "选课",
      "校医院",
      "医保",
      "校园网",
      "图书馆",
      "洗衣",
      "理发",
      "快递",
      "外卖",
      "打印",
      "修车",
      "通勤",
      "校车",
      "班车",
      "大创",
      "导师",
      "科研",
      "报到",
      "体检",
      "户口",
      "档案",
      "奖学金",
      "助学金",
      "学费",
      "缴费",
      "缓考",
      "拔尖",
      "分流",
    ],
    message: "你输入的是一个主题词。为了避免随机用某一张卡代表整个主题，请补充你具体想知道的问题方向。",
    suggestions: (term) => [
      `${term}有什么基本流程？`,
      `${term}有哪些注意事项？`,
      `${term}新生需要知道什么？`,
      `${term}常见问题有哪些？`,
    ],
  },
];

export function classifyNeedsClarification(question: string): ClarificationDecision | null {
  const normalized = normalizeQuestionText(question);
  const rule = BARE_PROMPT_RULES.find((candidate) => candidate.terms.includes(normalized));
  if (!rule) return null;

  return {
    needsClarification: true,
    message: rule.message,
    suggestions: rule.suggestions(normalized),
  };
}

function hardOutMessage(label: string) {
  return `这个请求属于「${label}」，不在本知识库的稳定信息收录范围内。`;
}

function classifySensitivePersonalData(normalized: string): ScopeClassification | null {
  const personalMarkers = ["我的", "帮我查", "查我的", "查一下我的", "我自己的"];
  const dataMarkers = ["成绩", "排名", "绩点", "课表", "选课结果", "考试安排", "录取状态", "余额"];

  if (
    personalMarkers.some((marker) => normalized.includes(marker)) &&
    dataMarkers.some((marker) => normalized.includes(marker))
  ) {
    return {
      inScope: false,
      code: "PERSONAL_ACADEMIC_DATA",
      label: "个人教务数据",
      message: hardOutMessage("个人教务数据"),
    };
  }

  return null;
}

export function classifyP0Scope(question: string): ScopeClassification {
  const normalized = normalizeQuestionText(question);
  const sensitivePersonalData = classifySensitivePersonalData(normalized);
  if (sensitivePersonalData) return sensitivePersonalData;
  const hasNjuSignal = NJU_SIGNALS.some((kw) => normalized.includes(kw.toLowerCase()));

  for (const rule of HARD_OUT_OF_SCOPE_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return {
        inScope: false,
        code: rule.code,
        label: rule.label,
        message: hardOutMessage(rule.label),
      };
    }
  }

  for (const rule of GENERAL_OUT_OF_SCOPE_RULES) {
    if (!hasNjuSignal && rule.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return {
        inScope: false,
        code: rule.code,
        label: rule.label,
        message: hardOutMessage(rule.label),
      };
    }
  }

  for (const rule of NON_GOAL_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      // 白名单兜底：含校园信号词的不误杀，放行进检索
      if (hasNjuSignal) {
        return { inScope: true };
      }
      return { inScope: false, code: rule.code, label: rule.label, message: `这个请求属于「${rule.label}」，不在本知识库的收录范围内。` };
    }
  }
  return { inScope: true };
}



export function classifyNoResult(question: string): "GAP_RECORDED" | "OUT_OF_SCOPE" {
  const normalized = question.toLowerCase();
  if (classifySensitivePersonalData(normalized)) return "OUT_OF_SCOPE";
  if (HARD_OUT_OF_SCOPE_RULES.some((rule) => rule.keywords.some((keyword) => normalized.includes(keyword)))) {
    return "OUT_OF_SCOPE";
  }
  const hasNjuSignal = NJU_SIGNALS.some((kw) => normalized.includes(kw.toLowerCase()));
  if (
    !hasNjuSignal &&
    GENERAL_OUT_OF_SCOPE_RULES.some((rule) => rule.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())))
  ) {
    return "OUT_OF_SCOPE";
  }

  return hasNjuSignal
    ? "GAP_RECORDED"
    : "OUT_OF_SCOPE";
}
