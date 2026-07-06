import { describe, it, expect } from "vitest";
import { scoreCard, isSpec } from "../scoring";
import type { RetrievalCard } from "../types-internal";

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

describe("isSpec", () => {
  it("returns true for domain-specific terms", () => {
    expect(isSpec("选课")).toBe(true);
    expect(isSpec("保研")).toBe(true);
    expect(isSpec("转专业")).toBe(true);
  });

  it("returns false for generic terms", () => {
    expect(isSpec("大学")).toBe(false);
    expect(isSpec("怎么")).toBe(false);
  });

  it("returns true for short alphanumeric terms", () => {
    expect(isSpec("vpn")).toBe(true);
  });

  it("returns true for terms with 3+ chars", () => {
    expect(isSpec("教务处")).toBe(true);
  });
});

describe("scoreCard", () => {
  it("scores higher for summary match than body match", () => {
    const card = makeCard();
    const summaryOnly = scoreCard(card, ["转专业"]);
    expect(summaryOnly.score).toBeGreaterThan(0);
  });

  it("returns zero score for unrelated terms even when source is trusted", () => {
    const card = makeCard({ summary: "test", body: "test" });
    const result = scoreCard(card, ["xyz"]);
    expect(result.score).toBe(0);
    expect(result.matchedTerms).toEqual([]);
  });

  it("adds bonus for VERIFIED status", () => {
    const card = makeCard({ verificationStatus: "VERIFIED" });
    const unverified = makeCard({ verificationStatus: "UNVERIFIED" });
    const r1 = scoreCard(card, ["转专业"]);
    const r2 = scoreCard(unverified, ["转专业"]);
    expect(r1.score).toBeGreaterThan(r2.score);
  });

  it("adds bonus for OFFICIAL sourceType", () => {
    const official = makeCard({ sourceType: "OFFICIAL" });
    const other = makeCard({ sourceType: "SENIOR" });
    const r1 = scoreCard(official, ["转专业"]);
    const r2 = scoreCard(other, ["转专业"]);
    expect(r1.score).toBeGreaterThan(r2.score);
  });

  it("scores longer specific terms higher", () => {
    const card = makeCard({ body: "大一申请转专业需要绩点前30%" });
    const r1 = scoreCard(card, ["提交"]);
    const r2 = scoreCard(card, ["转专业"]);
    expect(r2.score).toBeGreaterThan(r1.score);
  });
});
