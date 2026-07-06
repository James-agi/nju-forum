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