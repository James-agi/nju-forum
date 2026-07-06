import { describe, it, expect } from "vitest";
import { extractRetrievalTerms } from "../term-extraction";

describe("extractRetrievalTerms", () => {
  it("extracts known SPEC terms from question", async () => {
    const terms = await extractRetrievalTerms("怎么选课？");
    expect(terms).toContain("选课");
  });

  it("extracts multiple known terms", async () => {
    const terms = await extractRetrievalTerms("南大转专业保研流程");
    expect(terms).toContain("转专业");
    expect(terms).toContain("保研");
  });

  it("returns empty array for generic only question", async () => {
    const terms = await extractRetrievalTerms("请问一下这个怎么办理");
    expect(terms.length).toBeLessThanOrEqual(1);
  });

  it("prioritizes SPEC terms over generic ones", async () => {
    const terms = await extractRetrievalTerms("转专业保研选课");
    const specPos = terms.indexOf("转专业");
    const genericPos = terms.indexOf("选课");
    // SPEC terms should come first
    expect(specPos).toBeLessThan(genericPos);
  });

  it("applies ALIAS expansion", async () => {
    const terms = await extractRetrievalTerms("怎么修课程");
    expect(terms).toContain("修读");
  });

  it("limits output to 15 terms", async () => {
    // A very long question with many potential terms
    const terms = await extractRetrievalTerms(
      "南大选课转专业保研军训宿舍医保学费缴费学籍体检户口档案院系竞赛科研食堂校车VPN一卡通",
    );
    expect(terms.length).toBeLessThanOrEqual(15);
  });
});
