import { describe, it, expect } from "vitest";
import { scoreCard, evaluateEvidence } from "../retrieval";
import type { RetrievalCard, RetrievalResult } from "../retrieval";
import { classifyP0Scope, classifyNoResult } from "../scope";
import { normalizeQuestionText } from "../validation";

function makeCard(overrides: Partial<RetrievalCard> = {}): RetrievalCard {
  return {
    id: "card-1",
    summary: "南大转专业流程",
    body: "转专业需要在大一下学期提交申请，绩点要求前30%",
    sourceExcerpt: "",
    sourceUrl: "https://example.com",
    sourceDescription: "教务处通知",
    sourceType: "OFFICIAL",
    verificationStatus: "VERIFIED",
    domainTag: "学籍",
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    ...overrides,
  };
}

describe("normalizeQuestionText", () => {
  it("trims and lowercases", () => {
    expect(normalizeQuestionText("  VPN怎么用？ ")).toBe("vpn怎么用");
  });

  it("collapses whitespace", () => {
    expect(normalizeQuestionText("南大  转专业  条件")).toBe("南大 转专业 条件");
  });

  it("removes Chinese punctuation", () => {
    expect(normalizeQuestionText("请问，选课系统怎么用？")).toBe("请问选课系统怎么用");
  });
});

describe("scoreCard", () => {
  it("scores higher for summary match than body match", () => {
    const card = makeCard({ summary: "转专业条件", body: "需要绩点前30%" });
    const result = scoreCard(card, ["转专业"]);
    expect(result.score).toBeGreaterThan(0);
    expect(result.matchedTerms).toContain("转专业");
  });

  it("returns zero score for unrelated terms", () => {
    const card = makeCard({
      summary: "校园卡补办",
      body: "去中心办理挂失",
      verificationStatus: "NEEDS_REVIEW",
      sourceType: "OTHER",
    });
    const result = scoreCard(card, ["保研", "推免"]);
    expect(result.score).toBe(0);
    expect(result.matchedTerms).toHaveLength(0);
  });

  it("adds bonus for VERIFIED status", () => {
    const verified = makeCard({ verificationStatus: "VERIFIED" });
    const needsReview = makeCard({ verificationStatus: "NEEDS_REVIEW" });
    const terms = ["转专业"];
    expect(scoreCard(verified, terms).score).toBeGreaterThan(
      scoreCard(needsReview, terms).score
    );
  });

  it("adds bonus for OFFICIAL sourceType", () => {
    const official = makeCard({ sourceType: "OFFICIAL" });
    const community = makeCard({ sourceType: "OTHER" });
    const terms = ["转专业"];
    expect(scoreCard(official, terms).score).toBeGreaterThan(
      scoreCard(community, terms).score
    );
  });

  it("scores longer specific terms higher", () => {
    const card = makeCard({
      summary: "三三制培养方案选课",
      body: "三三制是南大特色培养方案",
    });
    const longTermResult = scoreCard(card, ["三三制培养方案"]);
    const shortTermResult = scoreCard(card, ["选课"]);
    expect(longTermResult.score).toBeGreaterThan(shortTermResult.score);
  });
});

describe("evaluateEvidence", () => {
  it("returns EMPTY for no results", () => {
    const result = evaluateEvidence([]);
    expect(result.sufficient).toBe(false);
    expect(result.reason).toBe("EMPTY");
  });

  it("returns ARCHIVED when all results are archived", () => {
    const archived: RetrievalResult = {
      card: makeCard({ archivedAt: new Date() }),
      score: 20,
      matchedTerms: ["转专业", "条件"],
    };
    const result = evaluateEvidence([archived]);
    expect(result.sufficient).toBe(false);
    expect(result.reason).toBe("ARCHIVED");
  });

  it("returns UNRELATED for low scores", () => {
    const weak: RetrievalResult = {
      card: makeCard(),
      score: 5,
      matchedTerms: ["南大"],
    };
    const result = evaluateEvidence([weak]);
    expect(result.sufficient).toBe(false);
    expect(result.reason).toBe("UNRELATED");
  });

  it("returns sufficient for high-scoring results with strong terms", () => {
    const strong: RetrievalResult = {
      card: makeCard({
        summary: "南大转专业流程和条件说明以及保研资格",
        body: "转专业需要大一下学期提交申请，绩点要求前30%，保研需要通过转入院系面试",
      }),
      score: 18,
      matchedTerms: ["转专业", "保研", "绩点", "申请"],
    };
    const result = evaluateEvidence([strong]);
    expect(result.sufficient).toBe(true);
    expect(result.cards.length).toBeGreaterThan(0);
  });

  it("rejects when all cards are NEEDS_REVIEW", () => {
    const needsReview: RetrievalResult = {
      card: makeCard({
        verificationStatus: "NEEDS_REVIEW",
        summary: "南大转专业流程和条件说明以及保研资格",
        body: "转专业需要大一下学期提交申请，绩点要求前30%，保研需要通过转入院系面试",
      }),
      score: 18,
      matchedTerms: ["转专业", "保研", "绩点", "申请"],
    };
    const result = evaluateEvidence([needsReview]);
    expect(result.sufficient).toBe(false);
    expect(result.reason).toBe("NEEDS_REVIEW");
  });
});

describe("classifyP0Scope", () => {
  it("allows normal campus questions", () => {
    expect(classifyP0Scope("南大怎么转专业").inScope).toBe(true);
  });

  it("rejects homework requests", () => {
    const result = classifyP0Scope("帮我写作业");
    expect(result.inScope).toBe(false);
    expect(result.code).toBe("HOMEWORK");
  });

  it("rejects open chat", () => {
    const result = classifyP0Scope("讲个笑话");
    expect(result.inScope).toBe(false);
    expect(result.code).toBe("OPEN_CHAT");
  });

  it("rejects broad non-campus entertainment, programming, and travel questions", () => {
    expect(classifyP0Scope("推荐几部电影").code).toBe("GENERAL_ENTERTAINMENT");
    expect(classifyP0Scope("React hooks怎么用").code).toBe("GENERAL_PROGRAMMING");
    expect(classifyP0Scope("南京周末去哪玩").code).toBe("GENERAL_TRAVEL_SHOPPING");
  });

  it("allows stable campus-adjacent card topics that are already in the knowledge base", () => {
    expect(classifyP0Scope("教材要不要买新书？二手书去哪找？").inScope).toBe(true);
    expect(classifyP0Scope("如何向南哪助手投稿").inScope).toBe(true);
  });

  it("still rejects textbook exercise solving requests", () => {
    const result = classifyP0Scope("帮我解析教材课后题");
    expect(result.inScope).toBe(false);
    expect(result.code).toBe("TEXTBOOK");
  });

  it("rejects realtime weather questions", () => {
    const result = classifyP0Scope("\u5357\u4eac\u660e\u5929\u5929\u6c14\u600e\u4e48\u6837");
    expect(result.inScope).toBe(false);
    expect(result.code).toBe("REALTIME_WEATHER");
  });

  it("rejects personal academic data lookup requests", () => {
    const result = classifyP0Scope("\u5e2e\u6211\u67e5\u6211\u7684\u6210\u7ee9\u6392\u540d");
    expect(result.inScope).toBe(false);
    expect(result.code).toBe("PERSONAL_ACADEMIC_DATA");
  });

  it("rejects academic misconduct and direct paper completion requests", () => {
    expect(classifyP0Scope("考试怎么作弊不被发现").code).toBe("ACADEMIC_MISCONDUCT");
    expect(classifyP0Scope("帮我直接完成这篇英语论文").code).toBe("ACADEMIC_MISCONDUCT");
  });

  it("rejects concrete medical advice and personal account balance lookup", () => {
    expect(classifyP0Scope("我发烧了该吃什么药").code).toBe("MEDICAL_ADVICE");
    expect(classifyP0Scope("我的饭卡余额还有多少").code).toBe("PERSONAL_ACADEMIC_DATA");
  });

  it("allows campus question with blacklisted word + NJU signal", () => {
    const result = classifyP0Scope("食堂价格贵吗");
    expect(result.inScope).toBe(true);
  });

  it("allows homework system question with NJU signal", () => {
    const result = classifyP0Scope("作业提交系统怎么用");
    expect(result.inScope).toBe(false);
  });

  it("rejects pure payment question without campus context", () => {
    const result = classifyP0Scope("会员付费多少");
    expect(result.inScope).toBe(false);
    expect(result.code).toBe("PAYMENT");
  });
});

describe("classifyNoResult", () => {
  it("returns GAP_RECORDED for NJU-related question", () => {
    expect(classifyNoResult("南大图书馆几点关门")).toBe("GAP_RECORDED");
  });

  it("returns OUT_OF_SCOPE for non-NJU question", () => {
    expect(classifyNoResult("今天天气怎么样")).toBe("OUT_OF_SCOPE");
  });
});

describe("classifyNoResult hard blocks", () => {
  it("returns OUT_OF_SCOPE for hard blocked questions", () => {
    expect(classifyNoResult("\u5357\u4eac\u660e\u5929\u5929\u6c14\u600e\u4e48\u6837")).toBe("OUT_OF_SCOPE");
    expect(classifyNoResult("\u5e2e\u6211\u67e5\u6211\u7684\u6210\u7ee9\u6392\u540d")).toBe("OUT_OF_SCOPE");
  });
});
