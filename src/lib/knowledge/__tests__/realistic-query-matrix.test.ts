import { describe, expect, it } from "vitest";
import { analyzeRetrievalTerms } from "../term-extraction";
import { classifyNeedsClarification } from "../scope";
import { evaluateEvidence } from "../evidence";
import type { RetrievalResult } from "../types-internal";

function makeResult(
  overrides: Partial<RetrievalResult> & { cardOverrides?: Partial<RetrievalResult["card"]> } = {},
): RetrievalResult {
  return {
    card: {
      id: "card-1",
      summary: "南大知识卡片",
      body: "正文",
      sourceExcerpt: "",
      sourceUrl: "https://example.com",
      sourceDescription: "测试来源",
      sourceType: "OFFICIAL",
      verificationStatus: "VERIFIED",
      domainTag: "校园生活",
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
      ...(overrides.cardOverrides || {}),
    },
    score: 10,
    matchedTerms: [],
    ...overrides,
  };
}

describe("realistic user query matrix", () => {
  it.each([
    ["仙林校区"],
    ["保研"],
    ["挂科"],
    ["饭卡"],
    ["人工智能"],
    ["商学院"],
  ])("asks for clarification on bare prompt: %s", (question) => {
    expect(classifyNeedsClarification(question)?.needsClarification).toBe(true);
  });

  it.each([
    ["仙林校区食堂有什么？", ["食堂"], ["校区概况", "宿舍", "通勤"]],
    ["仙林校区吃饭有什么推荐", ["吃饭", "食堂", "餐饮"], ["校区概况", "宿舍", "通勤"]],
    ["仙林校区宿舍怎么样", ["宿舍"], ["校区概况", "食堂", "通勤"]],
    ["仙林校区快递地址怎么填", ["快递"], ["校区概况", "宿舍", "通勤"]],
  ])("keeps concrete campus-focus query out of overview expansion: %s", async (question, expected, forbidden) => {
    const terms = (await analyzeRetrievalTerms(question)).terms;
    expected.forEach((term) => expect(terms).toContain(term));
    forbidden.forEach((term) => expect(terms).not.toContain(term));
  });

  it.each([
    ["仙林校区概况"],
    ["仙林校区介绍"],
    ["仙林校区有什么"],
  ])("expands broad campus overview query: %s", async (question) => {
    const terms = (await analyzeRetrievalTerms(question)).terms;
    expect(terms).toEqual(expect.arrayContaining(["校区概况", "校园生活", "宿舍", "食堂"]));
  });

  it.each([
    [
      "图书馆几点关门",
      makeResult({
        question: "图书馆几点关门",
        score: 10,
        matchedTerms: ["图书馆"],
        queryTerms: ["图书馆", "几点", "关门"],
        originalQueryTerms: ["图书馆", "几点", "关门"],
        cardOverrides: {
          summary: "仙林校区图书馆附近有哪些咖啡点位？",
          body: "这张卡整理图书馆附近咖啡点位，部分咖啡店晚上十点关门。",
        },
      }),
    ],
    [
      "哪个导师今年还缺学生",
      makeResult({
        question: "哪个导师今年还缺学生",
        score: 8,
        matchedTerms: ["导师"],
        queryTerms: ["导师", "今年", "还缺", "学生"],
        originalQueryTerms: ["导师", "今年", "还缺", "学生"],
        cardOverrides: {
          summary: "新生入学有哪些免费吃饭的机会？",
          body: "新生导师和朋辈导师有时会请学生吃饭。",
        },
      }),
    ],
    [
      "保研有什么要求",
      makeResult({
        question: "保研有什么要求",
        score: 10,
        matchedTerms: ["保研", "要求"],
        queryTerms: ["保研", "要求"],
        originalQueryTerms: ["保研", "要求"],
        cardOverrides: {
          summary: "挂科了怎么办？补考和重修的区别是什么，保研受影响吗？",
          body: "这张卡说明挂科和重修可能影响保研。",
        },
      }),
    ],
  ])("rejects weak evidence for direct-answer query: %s", (_question, result) => {
    const evidence = evaluateEvidence([result]);
    expect(evidence.sufficient).toBe(false);
    expect(evidence.reason).toBe("UNRELATED");
  });
});
