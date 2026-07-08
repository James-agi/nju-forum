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
import { chatCompletion } from "../llm-client";

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
  it("falls back when the LLM answer introduces unsupported campus context", async () => {
    vi.mocked(chatCompletion).mockResolvedValueOnce(JSON.stringify({
      answer: "你可以去苏州校区处理这个问题。",
      citations: [{ cardId: "card-1", claimText: "苏州校区可以处理" }],
    }));

    const result = makeResult();
    result.card.summary = "鼓楼到浦口校区怎么通勤？";
    result.card.body = "鼓楼到浦口可以参考公共交通和校园班车路线。";

    const answer = await buildCardBoundedAnswer("鼓楼到浦口怎么通勤", [result]);

    expect(answer.answerMode).toBe("FALLBACK");
    expect(answer.fallbackReason).toBe("VALIDATION_FAILED");
    expect(answer.answerText).not.toContain("苏州校区处理");
  });

  it("keeps a valid LLM answer and appends a partial coverage note when needed", async () => {
    vi.mocked(chatCompletion).mockResolvedValueOnce(JSON.stringify({
      answer: "从鼓楼到仙林可以参考地铁和公交路线。",
      citations: [{ cardId: "card-1", claimText: "鼓楼到仙林可参考地铁和公交路线" }],
    }));

    const result = makeResult();
    result.card.summary = "鼓楼北园到仙林校区怎么通勤？地铁路线和公交路线是什么？";
    result.card.body = "从鼓楼北园到仙林校区，推荐优先选择地铁，也可以选择公交换乘。";
    result.matchedTerms = ["鼓楼", "仙林", "通勤", "地铁", "公交"];
    result.queryTerms = ["鼓楼", "仙林", "通勤", "校车", "班车"];

    const answer = await buildCardBoundedAnswer("鼓楼到仙林怎么通勤，校车和班车怎么坐", [result]);

    expect(answer.answerMode).toBe("LLM");
    expect(answer.answerText).toContain("从鼓楼到仙林可以参考地铁和公交路线");
    expect(answer.answerText).toContain("证据缺口");
    expect(answer.answerText).toContain("校车/班车");
  });

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

  it("adds a partial coverage note when explicit transit modes are not covered by evidence", async () => {
    const result = makeResult();
    result.card.summary = "鼓楼北园到仙林校区怎么通勤？地铁路线和公交路线是什么？";
    result.card.body = "从鼓楼北园到仙林校区，推荐优先选择地铁，也可以选择公交换乘。";
    result.matchedTerms = ["鼓楼", "仙林", "通勤", "地铁", "公交"];
    result.queryTerms = ["鼓楼", "仙林", "通勤", "校车", "班车"];

    const answer = await buildCardBoundedAnswer("鼓楼到仙林怎么通勤，校车和班车怎么坐", [result]);

    expect(answer.answerText).toContain("证据缺口");
    expect(answer.answerText).toContain("校车/班车");
    expect(answer.answerText).toContain("不能确认这部分");
  });
});
