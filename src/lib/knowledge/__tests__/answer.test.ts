import { describe, expect, it, vi } from "vitest";
import type { RetrievalResult } from "../types-internal";

vi.mock("@/lib/knowledge/llm-client", async () => {
  const actual = await vi.importActual<typeof import("../llm-client")>("../llm-client");
  return {
    ...actual,
    chatCompletion: vi.fn().mockRejectedValue(new actual.LlmError("NO_CONFIG")),
  };
});

import { buildCardBoundedAnswer } from "../answer";

function makeResult(): RetrievalResult {
  return {
    card: {
      id: "card-1",
      summary: "鼓楼到浦口校区怎么通勤？",
      body: "可以参考公共交通和校园班车路线，具体安排以学校通知或系统为准。",
      sourceExcerpt: "",
      sourceUrl: "https://example.com",
      sourceDescription: "通勤指南",
      sourceType: "OFFICIAL",
      verificationStatus: "VERIFIED",
      domainTag: "校区交通",
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
    },
    score: 18,
    matchedTerms: ["鼓楼", "浦口", "班车"],
    queryTerms: ["明天", "鼓楼", "浦口", "班车", "有没有票"],
  };
}

describe("buildCardBoundedAnswer", () => {
  it("adds a limited-answer note for dynamic detail questions in fallback mode", async () => {
    const answer = await buildCardBoundedAnswer("明天鼓楼到浦口班车还有没有票", [makeResult()]);

    expect(answer.answerMode).toBe("FALLBACK");
    expect(answer.answerText).toContain("通用信息和查询路径");
    expect(answer.answerText).toContain("不能确认实时状态、个人数据或当年最终结果");
  });

  it("does not add the limited-answer note for ordinary stable questions", async () => {
    const answer = await buildCardBoundedAnswer("鼓楼到浦口怎么通勤", [makeResult()]);

    expect(answer.answerText).not.toContain("通用信息和查询路径");
  });

  it("uses evidence chunks in fallback mode when available", async () => {
    const result = makeResult();
    result.card.body = "第一段：无关背景。\n\n第二段：鼓楼到浦口可以参考公共交通。";
    result.evidenceChunks = [
      {
        chunkId: "card-1#chunk-2",
        cardId: "card-1",
        index: 1,
        text: "第二段：鼓楼到浦口可以参考公共交通。",
        score: 12,
        matchedTerms: ["鼓楼", "浦口"],
      },
    ];

    const answer = await buildCardBoundedAnswer("鼓楼到浦口怎么通勤", [result]);

    expect(answer.answerText).toContain("第二段");
    expect(answer.answerText).not.toContain("第一段");
  });

  it("adds a scope note when an unspecified-campus question only has one campus evidence", async () => {
    const result = makeResult();
    result.card.id = "xianlin-dorm-electricity";
    result.card.summary = "仙林宿舍：宿舍号看楼层，电费避开 22:40-0:00 线上充值";
    result.card.body = "仙林宿舍没电时，先检查门外墙上的电闸，再通过信息门户或南大 APP 充值。";
    result.evidenceChunks = [
      {
        chunkId: "xianlin-dorm-electricity#chunk-1",
        cardId: "xianlin-dorm-electricity",
        index: 0,
        text: "宿舍没电时，先检查门外墙上的电闸，再通过信息门户或南大 APP 充值。",
        score: 12,
        matchedTerms: ["宿舍", "没电"],
      },
    ];

    const answer = await buildCardBoundedAnswer("宿舍没电了是找宿管还是自己缴费", [result]);

    expect(answer.answerText).toContain("范围提示");
    expect(answer.answerText).toContain("主要覆盖仙林校区");
    expect(answer.answerText).toContain("不能直接把这条规则推广到所有校区");
  });

  it("does not add a single-campus scope note when the question already names that campus", async () => {
    const result = makeResult();
    result.card.summary = "仙林宿舍：宿舍号看楼层，电费避开 22:40-0:00 线上充值";
    result.card.body = "仙林宿舍没电时，先检查门外墙上的电闸，再通过信息门户或南大 APP 充值。";

    const answer = await buildCardBoundedAnswer("仙林宿舍没电了怎么办", [result]);

    expect(answer.answerText).not.toContain("范围提示");
  });
});
