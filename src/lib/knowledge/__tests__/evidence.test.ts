import { describe, it, expect } from "vitest";
import { evaluateEvidence } from "../evidence";
import type { RetrievalResult } from "../types-internal";

function makeResult(
  overrides: Partial<RetrievalResult> & { cardOverrides?: Partial<RetrievalResult["card"]> } = {},
): RetrievalResult {
  return {
    card: {
      id: "card-1",
      summary: "南大转专业保研流程",
      body: "转专业需要在大一下学期提交申请，保研需要绩点前30%",
      sourceExcerpt: "",
      sourceUrl: "https://example.com",
      sourceDescription: "教务处通知",
      sourceType: "OFFICIAL",
      verificationStatus: "VERIFIED",
      domainTag: "学籍",
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
      ...(overrides.cardOverrides || {}),
    },
    score: 18,
    matchedTerms: ["转专业", "保研"],
    ...overrides,
  };
}

describe("evaluateEvidence", () => {
  it("returns EMPTY for no results", () => {
    const result = evaluateEvidence([]);
    expect(result.sufficient).toBe(false);
    expect(result.reason).toBe("EMPTY");
  });

  it("returns ARCHIVED when all results are archived", () => {
    const results = [makeResult({ cardOverrides: { archivedAt: new Date() } })];
    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(false);
    expect(result.reason).toBe("ARCHIVED");
  });

  it("returns UNRELATED for low scores", () => {
    const results = [makeResult({ score: 1, matchedTerms: ["转专业"] })];
    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(false);
    expect(result.reason).toBe("UNRELATED");
  });

  it("accepts a reinforced single Chinese domain anchor", () => {
    const anchor = "\u8f6c\u4e13\u4e1a";
    const results = [
      makeResult({
        score: 10,
        matchedTerms: [anchor],
        cardOverrides: {
          summary: "\u5357\u5927\u8f6c\u4e13\u4e1a\u9650\u5236\u548c\u7533\u8bf7\u8bf4\u660e",
          body: "\u8f6c\u4e13\u4e1a\u7533\u8bf7\u9700\u8981\u5173\u6ce8\u9662\u7cfb\u9650\u5236\u3001\u6210\u7ee9\u8981\u6c42\u548c\u65f6\u95f4\u8282\u70b9",
        },
      }),
    ];
    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(true);
    expect(result.reason).toBe("PREFILTER_PASSED");
  });

  it("rejects a single anchor that is not supported by card body", () => {
    const anchor = "\u8f6c\u4e13\u4e1a";
    const results = [
      makeResult({
        score: 10,
        matchedTerms: [anchor],
        cardOverrides: {
          summary: "\u5357\u5927\u8f6c\u4e13\u4e1a\u9650\u5236",
          body: "\u8fd9\u5f20\u5361\u7247\u53ea\u8bf4\u660e\u9662\u7cfb\u57f9\u517b\u65b9\u6848\uff0c\u6ca1\u6709\u652f\u6491\u5177\u4f53\u7533\u8bf7\u4fe1\u606f",
        },
      }),
    ];
    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(false);
    expect(result.reason).toBe("UNRELATED");
  });

  it("uses the highest scoring candidate even when retrieval order differs", () => {
    const anchor = "\u8f6c\u4e13\u4e1a";
    const results = [
      makeResult({
        score: 5,
        matchedTerms: ["\u5357\u4eac"],
        cardOverrides: {
          id: "weak",
          summary: "\u5357\u4eac\u5927\u5b66\u6821\u56ed\u4fe1\u606f",
          body: "\u8fd9\u5f20\u5361\u7247\u548c\u95ee\u9898\u5173\u8054\u4e0d\u5f3a",
          updatedAt: new Date("2025-01-01"),
        },
      }),
      makeResult({
        score: 10,
        matchedTerms: [anchor],
        cardOverrides: {
          id: "strong",
          summary: "\u5357\u5927\u8f6c\u4e13\u4e1a\u9650\u5236\u548c\u7533\u8bf7\u8bf4\u660e",
          body: "\u8f6c\u4e13\u4e1a\u7533\u8bf7\u9700\u8981\u5173\u6ce8\u9662\u7cfb\u9650\u5236\u3001\u6210\u7ee9\u8981\u6c42\u548c\u65f6\u95f4\u8282\u70b9",
          updatedAt: new Date("2025-02-01"),
        },
      }),
    ];
    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(true);
    expect(result.cards[0].card.id).toBe("strong");
  });

  it("returns sufficient for high-scoring results with strong terms", () => {
    const results = [makeResult()];
    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(true);
    expect(result.reason).toBe("PREFILTER_PASSED");
  });

  it("rejects when all cards are NEEDS_REVIEW", () => {
    const results = [
      makeResult({
        cardOverrides: { verificationStatus: "NEEDS_REVIEW" as const },
      }),
    ];
    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(false);
    expect(result.reason).toBe("NEEDS_REVIEW");
  });

  it("prefers active cards over archived ones", () => {
    const results = [
      makeResult({
        cardOverrides: { id: "card-1", archivedAt: new Date() },
        score: 18,
        matchedTerms: ["转专业", "保研"],
      }),
      makeResult({
        cardOverrides: { id: "card-2" },
        score: 18,
        matchedTerms: ["转专业", "保研"],
      }),
    ];
    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(true);
    expect(result.cards.length).toBeGreaterThan(0);
    expect(result.cards[0].card.id).toBe("card-2");
  });
});
