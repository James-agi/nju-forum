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
});
