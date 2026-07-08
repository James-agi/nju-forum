import { describe, expect, it } from "vitest";
import { isSpec, scoreCard } from "../scoring";
import type { RetrievalCard } from "../types-internal";

function makeCard(overrides: Partial<RetrievalCard> = {}): RetrievalCard {
  return {
    id: "card-cjk",
    summary: "劳动教育理论课程怎么修",
    body: "劳动教育理论课程会自动进入课表，需要加入课程群并按时考试。",
    sourceExcerpt: "",
    sourceUrl: "https://example.com",
    sourceDescription: "测试来源",
    sourceType: "DOCUMENT",
    verificationStatus: "VERIFIED",
    domainTag: "课程学业",
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    ...overrides,
  };
}

describe("CJK scoring", () => {
  it("treats two-character Chinese terms as specific terms", () => {
    expect(isSpec("劳动")).toBe(true);
    expect(isSpec("理论")).toBe(true);
  });

  it("scores two-character Chinese terms strongly enough for evidence", () => {
    const result = scoreCard(makeCard(), ["劳动", "教育", "理论", "课程"]);

    expect(result.score).toBeGreaterThanOrEqual(12);
    expect(result.matchedTerms).toEqual(["劳动", "教育", "理论", "课程"]);
  });
});
