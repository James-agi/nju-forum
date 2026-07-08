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

  it("expands lost-card wording to replacement actions", async () => {
    const terms = await extractRetrievalTerms("饭卡丢了怎么办");
    expect(terms).toContain("校园卡");
    expect(terms).toContain("一卡通");
    expect(terms).toContain("挂失");
    expect(terms).toContain("补办");
  });

  it("expands colloquial recommendation questions", async () => {
    const terms = await extractRetrievalTerms("保研怎么搞");
    expect(terms).toContain("保研");
    expect(terms).toContain("推免");
    expect(terms).toContain("夏令营");
    expect(terms).toContain("预推免");
    expect(terms).toContain("保研课");
  });

  it("keeps common major abbreviations as stable retrieval terms", async () => {
    const terms = await extractRetrievalTerms("AI转CS失败后还能去天文吗");
    expect(terms).toContain("ai");
    expect(terms).toContain("cs");
    expect(terms).toContain("计算机科学");
    expect(terms).toContain("天文");
    expect(terms).toContain("转专业");
    expect(terms).toContain("转专业机会");
  });

  it("expands college and program nicknames", async () => {
    const terms = await extractRetrievalTerms("智科和智软还有集电分别在哪个校区");
    expect(terms).toContain("智能科学");
    expect(terms).toContain("智能软件");
    expect(terms).toContain("集成电路");
    expect(terms).toContain("在哪个校区");
  });

  it("expands academic record and service nicknames", async () => {
    const terms = await extractRetrievalTerms("GPA登错了要去ehall还是找教务");
    expect(terms).toContain("gpa");
    expect(terms).toContain("学分绩");
    expect(terms).toContain("成绩更正");
    expect(terms).toContain("ehall");
    expect(terms).toContain("教务");
  });

  it("expands shopping-service wording to campus store terms", async () => {
    const terms = await extractRetrievalTerms("学校里哪里能买点日用品");
    expect(terms).toContain("教超");
    expect(terms).toContain("教育超市");
    expect(terms).toContain("便利店");
    expect(terms).toContain("商铺");
    expect(terms).toContain("日用品");
  });

  it("limits output to 15 terms", async () => {
    // A very long question with many potential terms
    const terms = await extractRetrievalTerms(
      "南大选课转专业保研军训宿舍医保学费缴费学籍体检户口档案院系竞赛科研食堂校车VPN一卡通",
    );
    expect(terms.length).toBeLessThanOrEqual(15);
  });
});
