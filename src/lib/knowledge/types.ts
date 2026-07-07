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
  "三三制",
  "选课规则",
  "校园服务",
  "院系结构",
  "保研转专业",
  "竞赛科研",
  "其他",
] as const;

export type SourceTypeValue = (typeof SOURCE_TYPES)[number];
export type VerificationStatusValue = (typeof VERIFICATION_STATUSES)[number];
export type QuestionStatusValue = (typeof QUESTION_STATUSES)[number];
export type GapStatusValue = (typeof GAP_STATUSES)[number];
export type GapTypeValue = (typeof GAP_TYPES)[number];
export type KnowledgeAnswerModeValue = (typeof KNOWLEDGE_ANSWER_MODES)[number];

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
