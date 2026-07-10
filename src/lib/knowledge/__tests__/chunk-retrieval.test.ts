import { describe, expect, it } from "vitest";
import { scoreEvidenceChunks } from "../chunk-retrieval";
import type { RetrievalResult } from "../types-internal";

function makeResult(overrides: Partial<RetrievalResult> = {}): RetrievalResult {
  return {
    card: {
      id: "haircut-card",
      summary: "校内外哪里可以理发？",
      body: [
        "【仙林】一组团附近有理发店。",
        "",
        "【鼓楼】鼓楼教超旁边有一家飞丝流彩理发店。",
        "",
        "【苏州】苏州校区校内也有理发店。",
      ].join("\n"),
      sourceExcerpt: "",
      sourceUrl: "https://example.com",
      sourceDescription: "生活服务卡",
      sourceType: "SENIOR",
      verificationStatus: "VERIFIED",
      domainTag: "校园生活",
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
    },
    score: 17,
    matchedTerms: ["鼓楼", "理发"],
    queryTerms: ["南大", "鼓楼", "理发店"],
    ...overrides,
  };
}

describe("scoreEvidenceChunks", () => {
  it("selects the chunk that matches the requested campus", () => {
    const chunks = scoreEvidenceChunks(makeResult(), 2);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].text).toContain("鼓楼");
    expect(chunks[0].text).not.toContain("苏州");
  });

  it("keeps multiple service chunks when no campus is requested", () => {
    const chunks = scoreEvidenceChunks(
      makeResult({
        matchedTerms: ["理发"],
        queryTerms: ["南大", "理发店"],
      }),
      3,
    );

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.map((chunk) => chunk.text).join("\n")).toContain("仙林");
    expect(chunks.map((chunk) => chunk.text).join("\n")).toContain("鼓楼");
  });

  it("keeps sibling campus chunks when a single-service card implies the service in the title", () => {
    const chunks = scoreEvidenceChunks(
      makeResult({
        card: {
          ...makeResult().card,
          summary: "校内外哪里可以理发？",
          body: [
            "仙林：",
            "- 四栋楼下有「阿玛尼」，男生理发15元一次。",
            "- 学校对面和园有几家理发店。",
            "",
            "鼓楼：",
            "- 教超边上有一家「飞丝流彩」，来源评价水平一般。",
          ].join("\n"),
        },
        matchedTerms: ["理发店", "理发"],
        queryTerms: ["头发", "剪", "理发店", "理发"],
      }),
      3,
    );

    const text = chunks.map((chunk) => chunk.text).join("\n");
    expect(text).toContain("仙林");
    expect(text).toContain("鼓楼");
    expect(text).toContain("飞丝流彩");
  });
});
