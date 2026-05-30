import { normalizeQuestionText } from "@/lib/knowledge/validation";

interface ScopeRule {
  code: string;
  label: string;
  keywords: string[];
}

const NON_GOAL_RULES: ScopeRule[] = [
  {
    code: "TEXTBOOK",
    label: "教材问答",
    keywords: ["教材", "课本", "课后题", "例题解析", "textbook"],
  },
  {
    code: "HOMEWORK",
    label: "作业看板或代做作业",
    keywords: ["作业", "homework", "帮我写", "代写", "答案是什么"],
  },
  {
    code: "TODO",
    label: "ToDo 或个人计划",
    keywords: ["todo", "待办", "计划表", "提醒我", "日程安排"],
  },
  {
    code: "FORUM_UGC",
    label: "论坛或 UGC 投稿",
    keywords: ["发帖", "论坛", "帖子", "投稿", "用户贡献", "ugc"],
  },
  {
    code: "PUSH",
    label: "自动推送",
    keywords: ["推送", "通知我", "有答案了提醒", "订阅答案"],
  },
  {
    code: "WIKI",
    label: "Wiki 浏览模式",
    keywords: ["wiki", "知识地图", "浏览所有", "目录模式"],
  },
  {
    code: "MEMORY",
    label: "个性化记忆",
    keywords: ["记住我", "记住我的", "我的偏好", "个性化记忆", "长期记忆"],
  },
  {
    code: "PAYMENT",
    label: "付费或商业化",
    keywords: ["付费", "会员", "价格", "商业化", "订阅收费"],
  },
  {
    code: "OPEN_CHAT",
    label: "开放域闲聊",
    keywords: ["讲个笑话", "陪我聊天", "你是谁", "随便聊聊"],
  },
];

export interface ScopeClassification {
  inScope: boolean;
  code?: string;
  label?: string;
  message?: string;
}

export function classifyP0Scope(question: string): ScopeClassification {
  const normalized = normalizeQuestionText(question);

  for (const rule of NON_GOAL_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return {
        inScope: false,
        code: rule.code,
        label: rule.label,
        message: `这个请求属于「${rule.label}」，不属于 P0 的 NJU 信息沉淀范围。P0 只处理作者管理知识卡片、溯源问答和缺口记录。`,
      };
    }
  }

  return { inScope: true };
}
