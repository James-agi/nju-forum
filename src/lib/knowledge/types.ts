export const SOURCE_TYPES = [
  "OFFICIAL",
  "DOCUMENT",
  "SENIOR",
  "AUTHOR_EXPERIENCE",
  "OTHER",
] as const;

export const VERIFICATION_STATUSES = [
  "VERIFIED",
  "UNVERIFIED",
  "NEEDS_REVIEW",
] as const;

export const QUESTION_STATUSES = [
  "ANSWERED",
  "GAP_RECORDED",
  "OUT_OF_SCOPE",
] as const;

export const GAP_STATUSES = [
  "OPEN",
  "HANDLED",
  "DUPLICATE",
  "OUT_OF_SCOPE",
] as const;

export const GAP_TYPES = [
  "CONTENT",
  "DATA",
  "ACTION",
  "POLICY_UNCLEAR",
] as const;

export const KNOWLEDGE_ANSWER_MODES = [
  "cards",
  "think",
] as const;

export const KNOWLEDGE_DOMAIN_TAGS = [
  "新生入学",
  "课程学业",
  "成绩学籍",
  "专业院系",
  "分流转专业",
  "升学发展",
  "科研竞赛",
  "校园办事",
  "网络系统",
  "校园生活",
  "校区交通",
  "组织资源",
  "其他",
] as const;

export type SourceTypeValue = (typeof SOURCE_TYPES)[number];
export type VerificationStatusValue = (typeof VERIFICATION_STATUSES)[number];
export type QuestionStatusValue = (typeof QUESTION_STATUSES)[number];
export type GapStatusValue = (typeof GAP_STATUSES)[number];
export type GapTypeValue = (typeof GAP_TYPES)[number];
export type KnowledgeAnswerModeValue = (typeof KNOWLEDGE_ANSWER_MODES)[number];
export type KnowledgeDomainTagValue = (typeof KNOWLEDGE_DOMAIN_TAGS)[number];

export const KNOWLEDGE_DOMAIN_TAG_DESCRIPTIONS: Record<KnowledgeDomainTagValue, string> = {
  新生入学: "报到、入学材料、军训、宿舍分配、迁户口、新生防骗",
  课程学业: "选课、通识课、体育英语政治课、培养方案、学分、缓修、补考、重修",
  成绩学籍: "GPA、成绩更正、退学警示、取消学籍、开除学籍、学籍异动",
  专业院系: "院系介绍、专业介绍、学科实力、专业适配、校区归属、专业选择",
  分流转专业: "大类分流、转专业、二次选拔、拔尖班、实验班、准入课程、面试机试",
  升学发展: "保研、辅修、第二学士学位、交换、出国、暑研、就业前景",
  科研竞赛: "大创、竞赛、挑战杯、数学建模、导师课题、论文、创新项目",
  校园办事: "证明打印、校园卡、医保、社保卡、团组织证明、教务员、ehall、办事大厅",
  网络系统: "校园网、VPN、Eduroam、邮箱、正版软件、信息门户、APP、平台工具",
  校园生活: "宿舍、食堂、自习地点、社团、教材、快递、消费、校内日常体验",
  校区交通: "仙林、鼓楼、浦口、苏州校区生活、交通、就医、商圈、通勤",
  组织资源: "南哪助手、社群、QQ群、学生组织、投稿、公益平台、信息渠道",
  其他: "不属于以上任何一类",
};

export const SOURCE_TYPE_LABELS: Record<SourceTypeValue, string> = {
  OFFICIAL: "官方来源",
  DOCUMENT: "文档材料",
  SENIOR: "学长学姐经验",
  AUTHOR_EXPERIENCE: "作者经验",
  OTHER: "其他来源",
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatusValue, string> = {
  VERIFIED: "已核实",
  UNVERIFIED: "未核实",
  NEEDS_REVIEW: "需复核",
};

export const GAP_STATUS_LABELS: Record<GapStatusValue, string> = {
  OPEN: "待处理",
  HANDLED: "已处理",
  DUPLICATE: "重复",
  OUT_OF_SCOPE: "不属 P0",
};

export const GAP_TYPE_LABELS: Record<GapTypeValue, string> = {
  CONTENT: "缺内容",
  DATA: "缺数据",
  ACTION: "缺动作",
  POLICY_UNCLEAR: "政策不明",
};

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface KnowledgeCardDTO {
  id: string;
  summary: string;
  body: string;
  sourceExcerpt: string | null;
  sourceUrl: string | null;
  sourceDescription: string;
  sourceType: SourceTypeValue;
  verificationStatus: VerificationStatusValue;
  verifiedAt: string | null;
  domainTag: string;
  createdAt: string;
  updatedAt: string;
}

export interface CitationDTO {
  cardId: string;
  summary: string;
  body: string;
  sourceExcerpt: string | null;
  sourceDescription: string;
  sourceUrl: string | null;
  sourceType: SourceTypeValue;
  verificationStatus: VerificationStatusValue;
  claimText: string;
}

export interface DirectCardDTO {
  cardId: string;
  summary: string;
  body: string;
  sourceExcerpt: string | null;
  sourceDescription: string;
  sourceUrl: string | null;
  sourceType: SourceTypeValue;
  verificationStatus: VerificationStatusValue;
  domainTag: string;
  score: number;
  matchedTerms: string[];
}

export interface KnowledgeGapDTO {
  id: string;
  originalQuestion: string;
  status: GapStatusValue;
  gapType: GapTypeValue;
  linkedCardId: string | null;
  linkedCardSummary: string | null;
  duplicateOfId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationInfo {
  conversationId?: string;
  turnIndex?: number;
}

export type AskResponse =
  | (ConversationInfo & {
      status: "ANSWERED";
      questionId: string;
      answer: string;
      citations: CitationDTO[];
    })
  | (ConversationInfo & {
      status: "CARDS_FOUND";
      questionId: string;
      cards: DirectCardDTO[];
      message: string;
    })
  | (ConversationInfo & {
      status: "GAP_RECORDED";
      questionId: string;
      gapId: string;
      message: string;
    })
  | (ConversationInfo & {
      status: "OUT_OF_SCOPE";
      questionId: string;
      message: string;
    });
