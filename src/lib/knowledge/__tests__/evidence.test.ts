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

  it("accepts section evidence when context is in summary and answer is in a body section", () => {
    const results = [
      makeResult({
        score: 9,
        matchedTerms: ["\u9f13\u697c", "\u6d17\u8863\u5e97"],
        queryTerms: ["\u9f13\u697c", "\u5357\u5927\u9f13\u697c", "\u6d17\u8863\u5e97", "\u54ea\u91cc"],
        cardOverrides: {
          summary:
            "\u9f13\u697c\u6821\u533a\u751f\u6d3b\u670d\u52a1\u600e\u4e48\u7528\uff1f\uff08\u5feb\u9012/\u6d17\u8863/\u5916\u5356/\u4fbf\u5229\u5e97/\u6d17\u6d74\uff09",
          body:
            "\u3010\u5feb\u9012\u3011\u6821\u5185\u6709\u83dc\u9e1f\u9a7f\u7ad9\u3002\n\n\u3010\u6d17\u8863\u5e97\u3011\u6821\u5185\u548c\u548c\u5e73\u4ed3\u5df7\u90fd\u6709\u5e72\u6d17\u6d17\u978b\u5e97\u3002",
        },
      }),
    ];
    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(true);
    expect(result.reason).toBe("PREFILTER_PASSED");
  });

  it("does not treat a cross-word substring as section evidence", () => {
    const results = [
      makeResult({
        score: 7,
        matchedTerms: ["\u62a5\u5230", "\u6750\u6599"],
        queryTerms: ["\u62a5\u5230", "\u65b0\u751f", "\u6750\u6599"],
        cardOverrides: {
          summary: "\u521b\u65b0\u9879\u76ee\u4ece\u7533\u62a5\u5230\u7ed3\u9898\u7684\u5b8c\u6574\u6d41\u7a0b\u662f\u600e\u6837\u7684\uff1f",
          body:
            "\u3010\u6750\u6599\u3011\u9879\u76ee\u7533\u62a5\u5230\u7ed3\u9898\u9700\u8981\u63d0\u4ea4\u4e2d\u671f\u8868\u548c\u7ed3\u9898\u8868\u3002",
        },
      }),
    ];
    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(false);
    expect(result.reason).toBe("UNRELATED");
  });

  it("accepts related broad evidence even when dynamic opening-time details are not explicit", () => {
    const results = [
      makeResult({
        score: 13,
        matchedTerms: ["\u4ed9\u6797", "\u6821\u533a", "\u53d1\u5e97"],
        queryTerms: ["\u4ed9\u6797", "\u6821\u533a", "\u53d1\u5e97", "\u665a\u4e0a", "\u5341\u70b9", "\u5f00\u95e8"],
        cardOverrides: {
          summary: "\u4ed9\u6797\u6821\u533a\u4e00\u7ec4\u56e2\uff08\u4e00\u680b\u5230\u4e09\u680b\uff09\u9644\u8fd1\u6709\u54ea\u4e9b\u5546\u94fa\uff1f",
          body: "\u3010\u4e00\u7ec4\u56e2\u3011\u6709\u4fbf\u5229\u5e97\u3001\u6253\u5370\u5e97\u548c\u7406\u53d1\u5e97\u3002",
        },
      }),
    ];
    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(true);
    expect(result.reason).toBe("PREFILTER_PASSED");
  });

  it("accepts verified broad evidence for dynamic detail questions with a domain anchor", () => {
    const results = [
      makeResult({
        score: 6,
        matchedTerms: ["\u98df\u5802"],
        queryTerms: ["\u98df\u5802", "\u4eca\u5929", "\u591a\u5c11\u94b1"],
        cardOverrides: {
          summary: "\u82cf\u5dde\u6821\u533a\u98df\u5802\u6709\u54ea\u4e9b\uff1f\u4ef7\u683c\u548c\u5473\u9053\u600e\u4e48\u6837\uff1f",
          body: "\u5361\u7247\u6574\u7406\u4e86\u98df\u5802\u4f4d\u7f6e\u548c\u4e00\u822c\u5c31\u9910\u4fe1\u606f\u3002",
        },
      }),
    ];

    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(true);
    expect(result.reason).toBe("PREFILTER_PASSED");
  });

  it("accepts a low-scoring direct title match for a concrete campus service", () => {
    const results = [
      makeResult({
        score: 6,
        matchedTerms: ["\u7f34\u8d39"],
        queryTerms: ["\u5b66\u8d39", "\u7f34\u8d39", "\u600e\u4e48\u4ea4"],
        cardOverrides: {
          summary: "\u672c\u79d1\u65b0\u751f\u600e\u4e48\u7f34\u8d39\uff1f",
          body: "\u672c\u79d1\u65b0\u751f\u7f34\u8d39\u4ee5\u5b66\u6821\u901a\u77e5\u548c\u7f34\u8d39\u7cfb\u7edf\u4e3a\u51c6\u3002",
        },
      }),
    ];

    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(true);
    expect(result.reason).toBe("PREFILTER_PASSED");
  });

  it("accepts a low-scoring course-selection anchor for broad planning questions", () => {
    const results = [
      makeResult({
        score: 8,
        matchedTerms: ["\u9009\u8bfe"],
        queryTerms: ["\u9009\u8bfe", "\u5148\u770b", "\u522b\u628a\u540e\u9762\u8def\u5835\u6b7b"],
        cardOverrides: {
          summary: "\u65b0\u751f\u7b2c\u4e00\u6b21\u9009\u8bfe\u600e\u4e48\u8fdb\u7cfb\u7edf\uff1f\u521d\u9009\u3001\u9000\u8865\u9009\u5206\u522b\u8981\u505a\u4ec0\u4e48\uff1f",
          body: "\u9009\u8bfe\u524d\u5efa\u8bae\u5148\u770b\u57f9\u517b\u65b9\u6848\u3001\u901a\u8bc6\u8bfe\u8981\u6c42\u548c\u9000\u8865\u9009\u65f6\u95f4\u3002",
        },
      }),
    ];

    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(true);
    expect(result.reason).toBe("PREFILTER_PASSED");
  });

  it("accepts campus shopping evidence for daily-supplies questions", () => {
    const results = [
      makeResult({
        score: 12,
        matchedTerms: ["\u65e5\u7528\u54c1", "\u6559\u8d85", "\u4fbf\u5229\u5e97", "\u5546\u94fa"],
        queryTerms: ["\u65e5\u7528\u54c1", "\u6559\u8d85", "\u6559\u80b2\u8d85\u5e02", "\u4fbf\u5229\u5e97", "\u5546\u94fa"],
        cardOverrides: {
          summary: "\u4ed9\u6797\u6821\u533a\u4e00\u7ec4\u56e2\u9644\u8fd1\u6709\u54ea\u4e9b\u5546\u94fa\uff1f",
          body: "\u4e8c\u680b\u9644\u8fd1\u6709\u6559\u80b2\u8d85\u5e02\u548c\u4fbf\u5229\u5e97\uff0c\u53ef\u4ee5\u4e70\u65e5\u7528\u54c1\u3001\u65e9\u9910\u548c\u6587\u5177\u3002",
        },
      }),
    ];

    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(true);
    expect(result.reason).toBe("PREFILTER_PASSED");
  });

  it("does not answer unknown campus service questions from generic NJU terms only", () => {
    const results = [
      makeResult({
        score: 11,
        matchedTerms: ["\u5357\u5927\u6709", "\u6ca1\u6709"],
        queryTerms: ["\u5357\u5927\u6709", "\u5ba0\u7269\u6258", "\u6ca1\u6709", "\u7ba1\u70b9"],
        cardOverrides: {
          summary: "\u65b0\u751f\u6536\u5230\u7684\u300c\u6821\u56ed\u4fe1\u606f\u5361\u300d\u300c\u5bbd\u5e26\u4fe1\u606f\u5361\u300d\u662f\u4ec0\u4e48\uff1f\u548c\u5357\u5927\u6709\u6ca1\u6709\u5173\u7cfb\uff1f",
          body: "\u8fd9\u5f20\u5361\u53ea\u8bf4\u660e\u6821\u56ed\u4fe1\u606f\u5361\u548c\u5bbd\u5e26\u4fe1\u606f\u5361\u7684\u8bc6\u522b\u65b9\u5f0f\u3002",
        },
      }),
    ];

    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(false);
    expect(result.reason).toBe("UNRELATED");
  });

  it("does not accept broad dynamic evidence when only a location term matches", () => {
    const results = [
      makeResult({
        score: 7,
        matchedTerms: ["\u4ed9\u6797"],
        queryTerms: ["\u5e8a\u4f4d", "\u4ed9\u6797", "\u73b0\u5728", "\u7a7a\u5e8a"],
        cardOverrides: {
          summary: "\u4ed9\u6797\u6821\u533a\u4e00\u7ec4\u56e2\u9644\u8fd1\u6709\u54ea\u4e9b\u5546\u94fa\uff1f",
          body: "\u4ed9\u6797\u6821\u533a\u6709\u4fbf\u5229\u5e97\u548c\u6253\u5370\u5e97\u3002",
        },
      }),
    ];

    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(false);
    expect(result.reason).toBe("UNRELATED");
  });

  it("rejects route evidence that misses the requested campus location", () => {
    const results = [
      makeResult({
        score: 29,
        matchedTerms: ["\u901a\u52e4", "\u8def\u7ebf", "\u5730\u94c1", "\u516c\u4ea4", "\u6821\u533a"],
        queryTerms: ["\u600e\u4e48\u53bb", "\u82cf\u5dde", "\u901a\u52e4", "\u8def\u7ebf", "\u5730\u94c1", "\u516c\u4ea4", "\u6821\u533a"],
        cardOverrides: {
          summary: "\u9f13\u697c\u5317\u56ed\u5230\u4ed9\u6797\u6821\u533a\u600e\u4e48\u901a\u52e4\uff1f",
          body: "\u3010\u5730\u94c1\u3011\u4e58\u5750 4 \u53f7\u7ebf\u6362\u4e58 2 \u53f7\u7ebf\u3002\u3010\u516c\u4ea4\u3011\u53ef\u4ee5\u9009\u62e9\u516c\u4ea4\u8def\u7ebf\u3002",
        },
      }),
    ];
    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(false);
    expect(result.reason).toBe("UNRELATED");
  });

  it("uses a lower-ranked strong card when the top candidate misses required constraints", () => {
    const results = [
      makeResult({
        score: 29,
        matchedTerms: ["\u901a\u52e4", "\u8def\u7ebf", "\u5730\u94c1", "\u516c\u4ea4", "\u6821\u533a"],
        queryTerms: ["\u600e\u4e48\u53bb", "\u82cf\u5dde", "\u901a\u52e4", "\u8def\u7ebf", "\u5730\u94c1", "\u516c\u4ea4", "\u6821\u533a"],
        cardOverrides: {
          id: "wrong-location",
          summary: "\u9f13\u697c\u5317\u56ed\u5230\u4ed9\u6797\u6821\u533a\u600e\u4e48\u901a\u52e4\uff1f",
          body: "\u5730\u94c1\u548c\u516c\u4ea4\u90fd\u53ef\u4ee5\u8d70\u3002",
        },
      }),
      makeResult({
        score: 25,
        matchedTerms: ["\u82cf\u5dde", "\u8def\u7ebf", "\u5730\u94c1", "\u516c\u4ea4", "\u6821\u533a"],
        queryTerms: ["\u600e\u4e48\u53bb", "\u82cf\u5dde", "\u901a\u52e4", "\u8def\u7ebf", "\u5730\u94c1", "\u516c\u4ea4", "\u6821\u533a"],
        cardOverrides: {
          id: "correct-location",
          summary: "\u82cf\u5dde\u6821\u533a\u6821\u5916\u51fa\u884c\u600e\u4e48\u8d70\uff1f",
          body: "\u3010\u82cf\u5dde\u5317\u7ad9\u3011\u53ef\u4ee5\u5750\u5730\u94c1\u6362\u4e58\u5230\u82cf\u5dde\u6821\u533a\u3002\u516c\u4ea4\u548c\u8def\u7ebf\u4ee5\u5361\u7247\u4e3a\u51c6\u3002",
        },
      }),
    ];
    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(true);
    expect(result.cards[0].card.id).toBe("correct-location");
  });

  it("rejects cards whose title names a different campus location", () => {
    const results = [
      makeResult({
        score: 21,
        matchedTerms: ["\u7406\u53d1\u5e97", "\u9f13\u697c", "\u7406\u53d1"],
        queryTerms: ["\u7406\u53d1\u5e97", "\u9f13\u697c", "\u7406\u53d1"],
        cardOverrides: {
          id: "wrong-campus",
          summary: "\u82cf\u5dde\u6821\u533a\u6709\u4fbf\u5229\u5e97\u3001\u6253\u5370\u5e97\u548c\u7406\u53d1\u5e97\u5417\uff1f",
          body: "\u6821\u5185\u6709\u7406\u53d1\u5e97\uff0c\u4ef7\u683c\u6ca1\u6709\u9f13\u697c\u6559\u8d85\u90a3\u4e48\u53cb\u597d\u3002",
        },
      }),
      makeResult({
        score: 13,
        matchedTerms: ["\u7406\u53d1\u5e97", "\u9f13\u697c", "\u7406\u53d1"],
        queryTerms: ["\u7406\u53d1\u5e97", "\u9f13\u697c", "\u7406\u53d1"],
        cardOverrides: {
          id: "generic-haircut",
          summary: "\u6821\u5185\u5916\u54ea\u91cc\u53ef\u4ee5\u7406\u53d1\uff1f",
          body: "\u4ed9\u6797\u6709\u963f\u739b\u5c3c\u3002\u9f13\u697c\u6559\u8d85\u8fb9\u4e0a\u6709\u4e00\u5bb6\u300c\u98de\u4e1d\u6d41\u5f69\u300d\u3002",
        },
      }),
    ];

    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(true);
    expect(result.cards[0].card.id).toBe("generic-haircut");
  });

  it("prefers location-neutral service evidence when the question does not name a campus", () => {
    const results = [
      makeResult({
        score: 23,
        matchedTerms: ["自行车", "修理铺", "修理"],
        queryTerms: ["自行车", "修车", "修理", "修理铺"],
        cardOverrides: {
          id: "pukou-repair",
          summary: "浦口校区校内购物和修理服务（教超、打印店、修理铺）",
          body: "双亭园还有校园修理铺，提供修自行车服务。",
        },
      }),
      makeResult({
        score: 14,
        matchedTerms: ["自行车", "修车"],
        queryTerms: ["自行车", "修车", "修理", "修理铺"],
        cardOverrides: {
          id: "generic-bike",
          summary: "自行车/电动车哪里修、哪里打气？",
          body: "修车点包括一栋和三栋之间的一楼里边、大气楼门口。",
        },
      }),
    ];

    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(true);
    expect(result.cards[0].card.id).toBe("generic-bike");
    expect(result.cards.map((item) => item.card.id)).toContain("pukou-repair");
  });

  it("does not let expansion-only identity terms override the original topic anchor", () => {
    const results = [
      makeResult({
        score: 16,
        matchedTerms: ["校外", "校外人员"],
        queryTerms: ["校外", "图书馆", "校外人员", "图书馆访问", "入馆规定"],
        originalQueryTerms: ["校外", "校外人员", "图书馆"],
        cardOverrides: {
          id: "wrong-travel-reimburse",
          summary: "因公出国报销需要哪些材料？团组办理、校外人员、应届毕业生分别需要什么？",
          body: "校外人员办理因公出国报销时，需要准备任务批件、经费说明和票据。",
        },
      }),
      makeResult({
        score: 11,
        matchedTerms: ["图书馆"],
        queryTerms: ["校外", "图书馆", "校外人员", "图书馆访问", "入馆规定"],
        originalQueryTerms: ["校外", "校外人员", "图书馆"],
        cardOverrides: {
          id: "library-borrow",
          summary: "南京大学图书馆借书的基本流程是什么？",
          body: "图书馆借书需要通过统一检索系统查找图书，并到服务台或自助机办理。",
        },
      }),
    ];

    const result = evaluateEvidence(results);
    expect(result.sufficient).toBe(true);
    expect(result.cards[0].card.id).toBe("library-borrow");
    expect(result.cards.map((item) => item.card.id)).not.toContain("wrong-travel-reimburse");
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
