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
