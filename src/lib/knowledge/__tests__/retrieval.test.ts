import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RetrievalResult } from "../types-internal";

vi.mock("@/lib/db", () => ({
  db: {
    knowledgeCard: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

const mockHasVectors = vi.fn();
const mockSemanticSearch = vi.fn();
vi.mock("@/lib/knowledge/vector-store", () => ({
  hasVectors: (...args: unknown[]) => mockHasVectors(...args),
  semanticSearch: (...args: unknown[]) => mockSemanticSearch(...args),
}));

const mockExtractRetrievalTerms = vi.fn();
vi.mock("@/lib/knowledge/term-extraction", () => ({
  extractRetrievalTerms: (...args: unknown[]) => mockExtractRetrievalTerms(...args),
}));

const mockEmbedQuery = vi.fn();
vi.mock("@/lib/knowledge/embedding", () => ({
  embedQuery: (...args: unknown[]) => mockEmbedQuery(...args),
}));

import { db as realDb } from "@/lib/db";
const db = realDb as unknown as {
  knowledgeCard: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

const TRANSFER = "\u8f6c\u4e13\u4e1a";
const TRANSFER_QUESTION = "\u8f6c\u4e13\u4e1a\u9700\u8981\u4ec0\u4e48\u6761\u4ef6";

function makeCard(overrides: Record<string, unknown> = {}) {
  return {
    id: "card-1",
    summary: "\u5357\u5927\u8f6c\u4e13\u4e1a\u6d41\u7a0b",
    body: "\u9700\u8981\u7ee9\u70b9\u524d30%",
    sourceExcerpt: "",
    sourceUrl: "https://example.com",
    sourceDescription: "\u6559\u52a1\u5904\u901a\u77e5",
    sourceType: "OFFICIAL",
    verificationStatus: "VERIFIED",
    domainTag: "\u5b66\u7c4d",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-06-01"),
    archivedAt: null,
    ...overrides,
  };
}

async function importRetrieval() {
  return import("../retrieval");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExtractRetrievalTerms.mockResolvedValue([TRANSFER]);
  db.knowledgeCard.count.mockResolvedValue(0);
});

describe("retrieveKnowledgeCards", () => {
  it("returns empty when no terms extracted", async () => {
    mockExtractRetrievalTerms.mockResolvedValue([]);
    const { retrieveKnowledgeCards } = await importRetrieval();
    const result = await retrieveKnowledgeCards("??");
    expect(result).toEqual([]);
    expect(db.knowledgeCard.findMany).not.toHaveBeenCalled();
  });

  it("scores all active cards in application code and returns relevant results", async () => {
    const cards = [
      makeCard({ id: "c1", summary: "\u8f6c\u4e13\u4e1a\u6d41\u7a0b", body: "\u8f6c\u4e13\u4e1a\u9700\u8981\u7ee9\u70b9\u524d30%" }),
      makeCard({ id: "c2", summary: "\u9009\u8bfe\u6307\u5357", body: "\u9009\u8bfe\u7cfb\u7edf" }),
    ];
    db.knowledgeCard.findMany.mockResolvedValue(cards);

    const { retrieveKnowledgeCards } = await importRetrieval();
    const results = await retrieveKnowledgeCards(TRANSFER_QUESTION);

    expect(db.knowledgeCard.findMany).toHaveBeenCalledTimes(1);
    const callArgs = db.knowledgeCard.findMany.mock.calls[0][0];
    expect(callArgs.where).toEqual({ archivedAt: null });
    expect(callArgs.take).toBeUndefined();
    expect(callArgs.orderBy).toBeUndefined();

    expect(results.length).toBe(1);
    expect(results[0].card.id).toBe("c1");
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].queryTerms).toEqual([TRANSFER]);
  });

  it("uses the candidate pool only when candidate count is in the safe interval", async () => {
    mockExtractRetrievalTerms.mockResolvedValue(["\u8f6c\u4e13\u4e1a", "\u7ee9\u70b9"]);
    const cards = [
      makeCard({ id: "c1", summary: "\u8f6c\u4e13\u4e1a\u6d41\u7a0b", body: "\u8f6c\u4e13\u4e1a\u9700\u8981\u7ee9\u70b9\u524d30%" }),
    ];
    db.knowledgeCard.count.mockResolvedValue(120);
    db.knowledgeCard.findMany.mockResolvedValue(cards);

    const { retrieveKnowledgeCards } = await importRetrieval();
    const results = await retrieveKnowledgeCards(TRANSFER_QUESTION);

    expect(db.knowledgeCard.count).toHaveBeenCalledTimes(1);
    const countArgs = db.knowledgeCard.count.mock.calls[0][0];
    expect(countArgs.where.archivedAt).toBeNull();
    expect(countArgs.where.OR.length).toBeGreaterThan(0);

    const findArgs = db.knowledgeCard.findMany.mock.calls[0][0];
    expect(findArgs.where).toEqual(countArgs.where);
    expect(results.map((result) => result.card.id)).toEqual(["c1"]);
  });

  it("falls back to full scan when there is only one strong gate term", async () => {
    db.knowledgeCard.count.mockResolvedValue(120);
    db.knowledgeCard.findMany.mockResolvedValue([
      makeCard({ id: "c1", summary: "\u8f6c\u4e13\u4e1a\u6d41\u7a0b", body: "\u8f6c\u4e13\u4e1a\u9700\u8981\u7ee9\u70b9\u524d30%" }),
    ]);

    const { retrieveKnowledgeCards } = await importRetrieval();
    await retrieveKnowledgeCards(TRANSFER_QUESTION);

    expect(db.knowledgeCard.count).not.toHaveBeenCalled();
    const findArgs = db.knowledgeCard.findMany.mock.calls[0][0];
    expect(findArgs.where).toEqual({ archivedAt: null });
  });

  it("falls back to full scan when candidate count is too broad", async () => {
    mockExtractRetrievalTerms.mockResolvedValue(["\u8f6c\u4e13\u4e1a", "\u7ee9\u70b9"]);
    db.knowledgeCard.count.mockResolvedValue(800);
    db.knowledgeCard.findMany.mockResolvedValue([
      makeCard({ id: "c1", summary: "\u8f6c\u4e13\u4e1a\u6d41\u7a0b", body: "\u8f6c\u4e13\u4e1a\u9700\u8981\u7ee9\u70b9\u524d30%" }),
    ]);

    const { retrieveKnowledgeCards } = await importRetrieval();
    await retrieveKnowledgeCards(TRANSFER_QUESTION);

    const findArgs = db.knowledgeCard.findMany.mock.calls[0][0];
    expect(findArgs.where).toEqual({ archivedAt: null });
  });

  it("prioritizes general transfer cards for broad transfer-advice questions", async () => {
    mockExtractRetrievalTerms.mockResolvedValue(["\u8f6c\u4e13\u4e1a", "\u4e13\u4e1a", "\u5efa\u8bae"]);
    db.knowledgeCard.findMany.mockResolvedValue([
      makeCard({
        id: "specific-law",
        summary: "\u5357\u4eac\u5927\u5b66\u6cd5\u5b66\u8f6c\u4e13\u4e1a\u7684\u51c6\u5165\u95e8\u69db\u3001\u6d41\u7a0b\u548c\u8bfe\u7a0b\u9009\u62e9\u5efa\u8bae\u662f\u4ec0\u4e48\uff1f",
        body: "\u6cd5\u5b66\u8f6c\u4e13\u4e1a\u9700\u8981\u5173\u6ce8\u51c6\u5165\u8bfe\u7a0b\u3002",
      }),
      makeCard({
        id: "general",
        summary: "\u8f6c\u4e13\u4e1a\u96be\u4e0d\u96be\u3001\u4ec0\u4e48\u65f6\u5019\u7533\u8bf7\u3001\u6709\u4ec0\u4e48\u98ce\u9669\uff1f",
        body: "\u8f6c\u4e13\u4e1a\u9700\u8981\u5173\u6ce8\u7533\u8bf7\u65f6\u95f4\u3001\u7ade\u4e89\u548c\u5931\u8d25\u98ce\u9669\u3002",
      }),
    ]);

    const { retrieveKnowledgeCards } = await importRetrieval();
    const results = await retrieveKnowledgeCards("\u5927\u4e00\u65b0\u751f\u60f3\u8f6c\u4e13\u4e1a\u6709\u4ec0\u4e48\u5efa\u8bae\u5417", 2);

    expect(results.map((result) => result.card.id)).toEqual(["general", "specific-law"]);
  });

  it("keeps specific transfer cards when the question names that target", async () => {
    mockExtractRetrievalTerms.mockResolvedValue(["\u6cd5\u5b66", "\u8f6c\u4e13\u4e1a", "\u4e13\u4e1a", "\u5efa\u8bae"]);
    db.knowledgeCard.findMany.mockResolvedValue([
      makeCard({
        id: "specific-law",
        summary: "\u5357\u4eac\u5927\u5b66\u6cd5\u5b66\u8f6c\u4e13\u4e1a\u7684\u51c6\u5165\u95e8\u69db\u3001\u6d41\u7a0b\u548c\u8bfe\u7a0b\u9009\u62e9\u5efa\u8bae\u662f\u4ec0\u4e48\uff1f",
        body: "\u6cd5\u5b66\u8f6c\u4e13\u4e1a\u9700\u8981\u5173\u6ce8\u51c6\u5165\u8bfe\u7a0b\u3002",
      }),
      makeCard({
        id: "general",
        summary: "\u8f6c\u4e13\u4e1a\u96be\u4e0d\u96be\u3001\u4ec0\u4e48\u65f6\u5019\u7533\u8bf7\u3001\u6709\u4ec0\u4e48\u98ce\u9669\uff1f",
        body: "\u8f6c\u4e13\u4e1a\u9700\u8981\u5173\u6ce8\u7533\u8bf7\u65f6\u95f4\u3001\u7ade\u4e89\u548c\u5931\u8d25\u98ce\u9669\u3002",
      }),
    ]);

    const { retrieveKnowledgeCards } = await importRetrieval();
    const results = await retrieveKnowledgeCards("\u6cd5\u5b66\u8f6c\u4e13\u4e1a\u6709\u4ec0\u4e48\u5efa\u8bae", 2);

    expect(results[0].card.id).toBe("specific-law");
  });

  it("does not over-rank transfer cards for a different source context", async () => {
    mockExtractRetrievalTerms.mockResolvedValue([
      "人工智能",
      "AI",
      "天文",
      "数理大类",
      "专业",
      "失败",
      "转专业",
    ]);
    db.knowledgeCard.findMany.mockResolvedValue([
      makeCard({
        id: "engineering-test",
        summary: "工科试验班转专业有什么优势？失败后果严重吗？",
        body: "工科试验班转专业失败的后果不太严重，教务员可能愿意支持你大二继续尝试。",
      }),
      makeCard({
        id: "general-rule",
        summary: "南京大学转专业有哪些限制？四次转专业机会分别是什么？正常申请转专业怎么操作？",
        body: "南大有大一结束和大二结束等转专业机会。部分专业（如AI）可能不接受大二转入，具体要求看当年准入实施方案。",
      }),
      makeCard({
        id: "math-physics-ai",
        summary: "数理大类转热门工科（AI/CS/EE）有什么注意事项？",
        body: "数理大类转专业到热门工科很不友好，失败了本大类兜底选择很有限，主要是大气或天文。",
      }),
    ]);

    const { retrieveKnowledgeCards } = await importRetrieval();
    const results = await retrieveKnowledgeCards("我在大一想转人工智能专业失败去了天文专业，我该怎么办", 3);

    const ids = results.map((result) => result.card.id);
    expect(ids.slice(0, 2).sort()).toEqual(["general-rule", "math-physics-ai"]);
    expect(ids[2]).toBe("engineering-test");
    expect(results[1].score).toBeGreaterThan(results[2].score);
  });

  it("keeps cards whose strong keyword appears only in body", async () => {
    mockExtractRetrievalTerms.mockResolvedValue(["ai", "大二转", "专业", "失败"]);
    db.knowledgeCard.findMany.mockResolvedValue([
      makeCard({
        id: "body-only-limit",
        summary: "南京大学转专业有哪些限制？",
        body: "部分专业（如AI）可能不接受大二转入，具体要求看当年准入实施方案。",
      }),
      makeCard({
        id: "weak-only",
        summary: "专业选择失败后怎么调整心态？",
        body: "这张卡只泛泛讨论失败后的建议，没有提到具体转专业规则。",
      }),
    ]);

    const { retrieveKnowledgeCards } = await importRetrieval();
    const results = await retrieveKnowledgeCards("AI大二转失败后怎么办", 5);

    expect(results.map((result) => result.card.id)).toEqual(["body-only-limit"]);
    expect(results[0].matchedTerms).toContain("ai");
  });

  it("does not let weak keyword matches enter the retrieval interval", async () => {
    mockExtractRetrievalTerms.mockResolvedValue(["失败", "专业", "建议"]);
    db.knowledgeCard.findMany.mockResolvedValue([
      makeCard({
        id: "weak-only",
        summary: "专业选择失败后有什么建议？",
        body: "只命中失败、专业、建议这些泛化词。",
      }),
    ]);

    const { retrieveKnowledgeCards } = await importRetrieval();
    const results = await retrieveKnowledgeCards("失败了有什么建议", 5);

    expect(results).toEqual([]);
  });

  it("removes cards whose title names a different requested campus", async () => {
    mockExtractRetrievalTerms.mockResolvedValue(["仙林", "理发", "理发店"]);
    db.knowledgeCard.findMany.mockResolvedValue([
      makeCard({
        id: "wrong-campus",
        summary: "苏州校区有便利店、打印店和理发店吗？",
        body: "苏州校区校内有理发店。",
      }),
      makeCard({
        id: "right-campus",
        summary: "仙林校区哪里可以理发？",
        body: "仙林校区附近有理发店。",
      }),
    ]);

    const { retrieveKnowledgeCards } = await importRetrieval();
    const results = await retrieveKnowledgeCards("头发太长了，仙林这边学生一般去哪剪", 5);

    expect(results.map((result) => result.card.id)).toEqual(["right-campus"]);
  });

  it("prefers location-neutral service cards when the question does not name a campus", async () => {
    mockExtractRetrievalTerms.mockResolvedValue(["自行车", "修车", "修理", "修理铺"]);
    db.knowledgeCard.findMany.mockResolvedValue([
      makeCard({
        id: "pukou-repair",
        summary: "浦口校区校内购物和修理服务（教超、打印店、修理铺）",
        body: "双亭园还有校园修理铺，提供修自行车服务。",
      }),
      makeCard({
        id: "generic-bike",
        summary: "自行车/电动车哪里修、哪里打气？",
        body: "修车点包括一栋和三栋之间的一楼里边、大气楼门口。",
      }),
    ]);

    const { retrieveKnowledgeCards } = await importRetrieval();
    const results = await retrieveKnowledgeCards("自行车坏了怎么办", 5);

    expect(results[0].card.id).toBe("generic-bike");
    expect(results.map((result) => result.card.id)).toContain("pukou-repair");
  });

  it("keeps campus-specific service cards when the question names that campus", async () => {
    mockExtractRetrievalTerms.mockResolvedValue(["浦口", "自行车", "修车", "修理", "修理铺"]);
    db.knowledgeCard.findMany.mockResolvedValue([
      makeCard({
        id: "pukou-repair",
        summary: "浦口校区校内购物和修理服务（教超、打印店、修理铺）",
        body: "双亭园还有校园修理铺，提供修自行车服务。",
      }),
      makeCard({
        id: "generic-bike",
        summary: "自行车/电动车哪里修、哪里打气？",
        body: "修车点包括一栋和三栋之间的一楼里边、大气楼门口。",
      }),
    ]);

    const { retrieveKnowledgeCards } = await importRetrieval();
    const results = await retrieveKnowledgeCards("浦口自行车坏了怎么办", 5);

    expect(results[0].card.id).toBe("pukou-repair");
  });
});

describe("retrieveHybrid", () => {
  it("returns keyword-only results when hasVectors is false", async () => {
    mockHasVectors.mockResolvedValue(false);
    db.knowledgeCard.findMany.mockResolvedValue([makeCard({ id: "c1" })]);

    const { retrieveHybrid } = await importRetrieval();
    const results = await retrieveHybrid(TRANSFER_QUESTION);

    expect(results.length).toBe(1);
    expect(results[0].card.id).toBe("c1");
    expect(mockEmbedQuery).not.toHaveBeenCalled();
    expect(mockSemanticSearch).not.toHaveBeenCalled();
  });

  it("runs semantic path when hasVectors is true and embed succeeds", async () => {
    mockHasVectors.mockResolvedValue(true);
    mockEmbedQuery.mockResolvedValue([0.1, 0.2, 0.3]);
    mockSemanticSearch.mockResolvedValue([
      { cardId: "c-sem-1", similarity: 0.85 },
      { cardId: "c-sem-2", similarity: 0.72 },
    ]);

    db.knowledgeCard.findMany
      .mockResolvedValueOnce([makeCard({ id: "c1" })])
      .mockResolvedValueOnce([
        makeCard({ id: "c-sem-1", summary: "\u8f6c\u4e13\u4e1a\u6210\u7ee9\u8981\u6c42", body: "\u8f6c\u4e13\u4e1a\u9700\u8981\u6210\u7ee9\u8fbe\u6807" }),
        makeCard({ id: "c-sem-2", summary: "\u8f6c\u4e13\u4e1a\u9762\u8bd5", body: "\u9762\u8bd5\u6d41\u7a0b" }),
      ]);

    const { retrieveHybrid } = await importRetrieval();
    const results = await retrieveHybrid(TRANSFER_QUESTION);

    expect(mockEmbedQuery).toHaveBeenCalledTimes(1);
    expect(mockSemanticSearch).toHaveBeenCalledWith([0.1, 0.2, 0.3], 20);
    expect(results.length).toBeGreaterThan(0);
  });

  it("skips semantic results below similarity threshold", async () => {
    mockHasVectors.mockResolvedValue(true);
    mockEmbedQuery.mockResolvedValue([0.1, 0.2, 0.3]);
    mockSemanticSearch.mockResolvedValue([{ cardId: "c-low", similarity: 0.3 }]);

    db.knowledgeCard.findMany.mockResolvedValue([makeCard({ id: "c1" })]);

    const { retrieveHybrid } = await importRetrieval();
    const results = await retrieveHybrid(TRANSFER_QUESTION);

    expect(results.length).toBe(1);
    expect(results[0].card.id).toBe("c1");
  });

  it("skips semantic when embedQuery returns null", async () => {
    mockHasVectors.mockResolvedValue(true);
    mockEmbedQuery.mockResolvedValue(null);
    db.knowledgeCard.findMany.mockResolvedValue([makeCard({ id: "c1" })]);

    const { retrieveHybrid } = await importRetrieval();
    const results = await retrieveHybrid(TRANSFER_QUESTION);

    expect(results.length).toBe(1);
    expect(mockSemanticSearch).not.toHaveBeenCalled();
  });

  it("applies RRF fusion when both sources have results", async () => {
    mockHasVectors.mockResolvedValue(true);
    mockEmbedQuery.mockResolvedValue([0.1, 0.2, 0.3]);
    mockSemanticSearch.mockResolvedValue([
      { cardId: "c1", similarity: 0.9 },
      { cardId: "c2", similarity: 0.8 },
    ]);

    db.knowledgeCard.findMany
      .mockResolvedValueOnce([
        makeCard({ id: "c1", summary: "\u8f6c\u4e13\u4e1a\u6d41\u7a0b", body: "\u8f6c\u4e13\u4e1a\u9700\u8981\u7ee9\u70b9\u524d30%" }),
      ])
      .mockResolvedValueOnce([
        makeCard({ id: "c2", summary: "\u8f6c\u4e13\u4e1a\u9762\u8bd5", body: "\u8f6c\u4e13\u4e1a\u9762\u8bd5\u6d41\u7a0b" }),
      ]);

    const { retrieveHybrid } = await importRetrieval();
    const results = await retrieveHybrid(TRANSFER_QUESTION);

    expect(results.length).toBe(2);
    const ids = results.map((r: RetrievalResult) => r.card.id);
    expect(ids).toContain("c1");
    expect(ids).toContain("c2");
  });

  it("filters semantic-only cards with zero keyword score", async () => {
    mockHasVectors.mockResolvedValue(true);
    mockEmbedQuery.mockResolvedValue([0.1, 0.2, 0.3]);
    mockSemanticSearch.mockResolvedValue([
      { cardId: "c1", similarity: 0.9 },
      { cardId: "c-zero", similarity: 0.8 },
    ]);

    db.knowledgeCard.findMany
      .mockResolvedValueOnce([
        makeCard({ id: "c1", summary: "\u8f6c\u4e13\u4e1a\u6d41\u7a0b", body: "\u8f6c\u4e13\u4e1a\u9700\u8981\u7ee9\u70b9\u524d30%" }),
      ])
      .mockResolvedValueOnce([
        makeCard({ id: "c-zero", summary: "\u9009\u8bfe\u6307\u5357", body: "\u9009\u8bfe\u7cfb\u7edf" }),
      ]);

    const { retrieveHybrid } = await importRetrieval();
    const results = await retrieveHybrid(TRANSFER_QUESTION);

    const ids = results.map((r: RetrievalResult) => r.card.id);
    expect(ids).toContain("c1");
    expect(ids).not.toContain("c-zero");
  });
});
