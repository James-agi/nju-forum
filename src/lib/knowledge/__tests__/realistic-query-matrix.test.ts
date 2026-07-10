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
    [
      "晚上十点以后还有食堂吗",
      makeResult({
        question: "晚上十点以后还有食堂吗",
        score: 15,
        matchedTerms: ["食堂"],
        queryTerms: ["食堂", "晚上", "十点", "以后"],
        originalQueryTerms: ["食堂", "晚上", "十点", "以后"],
        cardOverrides: {
          summary: "南大有哪些食堂福利和餐券？",
          body: "这张卡整理一分钱早餐、校庆餐券和节日特色食品。",
        },
      }),
    ],
    [
      "快递站怎么填",
      makeResult({
        question: "快递站怎么填",
        score: 15,
        matchedTerms: ["快递"],
        queryTerms: ["快递站", "快递", "怎么填"],
        originalQueryTerms: ["快递站", "怎么填"],
        cardOverrides: {
          summary: "到付快递诈骗怎么识别",
          body: "没买东西却收到到付快递时，建议直接拒收。",
        },
      }),
    ],
    [
      "洗衣服怎么办",
      makeResult({
        question: "洗衣服怎么办",
        score: 15,
        matchedTerms: ["洗衣", "洗衣服"],
        queryTerms: ["洗衣店", "洗衣", "洗衣服"],
        originalQueryTerms: ["洗衣店", "洗衣", "洗衣服"],
        cardOverrides: {
          summary: "新生开学需要带哪些日化用品？",
          body: "建议带洗衣液、水盆和肥皂，贴身衣物可以手洗。",
        },
      }),
    ],
    [
      "到付快递怎么识别",
      makeResult({
        question: "到付快递怎么识别",
        score: 15,
        matchedTerms: ["快递"],
        queryTerms: ["快递", "怎么识别", "付快"],
        originalQueryTerms: ["快递", "怎么识别", "付快"],
        cardOverrides: {
          summary: "南京大学快递地址怎么写？",
          body: "仙林校区按组团填写菜根潭、静园或勇园快递站地址。",
        },
      }),
    ],
  ])("rejects weak evidence for direct-answer query: %s", (_question, result) => {
    const evidence = evaluateEvidence([result]);
    expect(evidence.sufficient).toBe(false);
    expect(evidence.reason).toBe("UNRELATED");
  });

  it.each([
    [
      "快递站怎么填",
      makeResult({
        question: "快递站怎么填",
        score: 18,
        matchedTerms: ["快递站", "快递"],
        queryTerms: ["快递站", "快递", "怎么填"],
        originalQueryTerms: ["快递站", "怎么填"],
        cardOverrides: {
          summary: "南京大学快递地址怎么写？",
          body: "仙林校区按组团填写菜根潭、静园或勇园快递站地址；鼓楼校区统一填写汉口路22号南京大学鼓楼校区。",
        },
      }),
    ],
    [
      "洗衣服怎么办",
      makeResult({
        question: "洗衣服怎么办",
        score: 18,
        matchedTerms: ["洗衣", "洗衣服"],
        queryTerms: ["洗衣店", "洗衣", "洗衣服"],
        originalQueryTerms: ["洗衣店", "洗衣", "洗衣服"],
        cardOverrides: {
          summary: "宿舍洗衣、用电、门禁、入住和日常管理规则有哪些？",
          body: "仙林一楼洗衣房有公共洗衣机，手机扫码支付，每次2到6元。",
        },
      }),
    ],
    [
      "鼓楼晚上哪里能吃饭",
      makeResult({
        question: "鼓楼晚上哪里能吃饭",
        score: 18,
        matchedTerms: ["鼓楼", "食堂", "晚上"],
        queryTerms: ["鼓楼", "吃饭", "餐厅", "食堂", "晚上", "哪里"],
        originalQueryTerms: ["鼓楼", "晚上", "吃饭"],
        cardOverrides: {
          summary: "鼓楼校区食堂和餐厅有哪些推荐？",
          body: "西苑餐厅中午和晚上营业，食堂吃腻了也可以出校门找吃的。",
        },
      }),
    ],
    [
      "到付快递怎么识别",
      makeResult({
        question: "到付快递怎么识别",
        score: 18,
        matchedTerms: ["快递", "怎么识别", "付快"],
        queryTerms: ["快递", "怎么识别", "付快"],
        originalQueryTerms: ["快递", "怎么识别", "付快"],
        cardOverrides: {
          summary: "到付快递诈骗怎么识别",
          body: "没买东西却收到到付快递时，可能是快递单信息泄露导致的诈骗，建议直接拒收。",
        },
      }),
    ],
  ])("accepts direct evidence for slotted service query: %s", (_question, result) => {
    const evidence = evaluateEvidence([result]);
    expect(evidence.sufficient).toBe(true);
    expect(evidence.reason).toBe("PREFILTER_PASSED");
  });
});
