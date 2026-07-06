import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RetrievalResult } from "../types-internal";

// -- mocks --
vi.mock("@/lib/db", () => ({
  db: {
    knowledgeCard: {
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
const db = realDb as unknown as { knowledgeCard: { findMany: ReturnType<typeof vi.fn> } };

function makeCard(overrides: Record<string, unknown> = {}) {
  return {
    id: "card-1",
    summary: "南大转专业流程",
    body: "需要绩点前30%",
    sourceExcerpt: "",
    sourceUrl: "https://example.com",
    sourceDescription: "教务处通知",
    sourceType: "OFFICIAL",
    verificationStatus: "VERIFIED",
    domainTag: "学籍",
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
  mockExtractRetrievalTerms.mockResolvedValue(["转专业"]);
});

describe("retrieveKnowledgeCards", () => {
  it("returns empty when no terms extracted", async () => {
    mockExtractRetrievalTerms.mockResolvedValue([]);
    const { retrieveKnowledgeCards } = await importRetrieval();
    const result = await retrieveKnowledgeCards("??");
    expect(result).toEqual([]);
    expect(db.knowledgeCard.findMany).not.toHaveBeenCalled();
  });

  it("queries DB with OR conditions and returns scored results", async () => {
    const cards = [
      makeCard({ id: "c1", summary: "转专业流程", body: "转专业需要绩点前30%" }),
      makeCard({ id: "c2", summary: "选课指南", body: "选课系统" }),
    ];
    db.knowledgeCard.findMany.mockResolvedValue(cards);

    const { retrieveKnowledgeCards } = await importRetrieval();
    const results = await retrieveKnowledgeCards("转专业需要什么条件");

    expect(db.knowledgeCard.findMany).toHaveBeenCalledTimes(1);
    const callArgs = db.knowledgeCard.findMany.mock.calls[0][0];
    expect(callArgs.where.OR.length).toBeGreaterThan(0);
    expect(callArgs.take).toBe(50);
    expect(callArgs.orderBy).toEqual([{ verificationStatus: "asc" }, { updatedAt: "desc" }]);

    expect(results.length).toBe(1);
    expect(results[0].card.id).toBe("c1");
    expect(results[0].score).toBeGreaterThan(0);
  });
});

describe("retrieveHybrid", () => {
  it("returns keyword-only results when hasVectors is false", async () => {
    mockHasVectors.mockResolvedValue(false);
    db.knowledgeCard.findMany.mockResolvedValue([makeCard({ id: "c1" })]);

    const { retrieveHybrid } = await importRetrieval();
    const results = await retrieveHybrid("转专业需要什么条件");

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
        makeCard({ id: "c-sem-1", summary: "转专业成绩要求", body: "转专业需要成绩达标" }),
        makeCard({ id: "c-sem-2", summary: "转专业面试", body: "面试流程" }),
      ]);

    const { retrieveHybrid } = await importRetrieval();
    const results = await retrieveHybrid("转专业需要什么条件");

    expect(mockEmbedQuery).toHaveBeenCalledTimes(1);
    expect(mockSemanticSearch).toHaveBeenCalledWith([0.1, 0.2, 0.3], 20);
    expect(results.length).toBeGreaterThan(0);
  });

  it("skips semantic results below similarity threshold", async () => {
    mockHasVectors.mockResolvedValue(true);
    mockEmbedQuery.mockResolvedValue([0.1, 0.2, 0.3]);
    mockSemanticSearch.mockResolvedValue([
      { cardId: "c-low", similarity: 0.3 },
    ]);

    db.knowledgeCard.findMany.mockResolvedValue([makeCard({ id: "c1" })]);

    const { retrieveHybrid } = await importRetrieval();
    const results = await retrieveHybrid("转专业需要什么条件");

    expect(results.length).toBe(1);
    expect(results[0].card.id).toBe("c1");
  });

  it("skips semantic when embedQuery returns null", async () => {
    mockHasVectors.mockResolvedValue(true);
    mockEmbedQuery.mockResolvedValue(null);
    db.knowledgeCard.findMany.mockResolvedValue([makeCard({ id: "c1" })]);

    const { retrieveHybrid } = await importRetrieval();
    const results = await retrieveHybrid("转专业需要什么条件");

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
        makeCard({ id: "c1", summary: "转专业流程", body: "转专业需要绩点前30%" }),
      ])
      .mockResolvedValueOnce([
        makeCard({ id: "c2", summary: "选课指南", body: "选课" }),
      ]);

    const { retrieveHybrid } = await importRetrieval();
    const results = await retrieveHybrid("转专业需要什么条件");

    expect(results.length).toBe(2);
    const ids = results.map((r: RetrievalResult) => r.card.id);
    expect(ids).toContain("c1");
    expect(ids).toContain("c2");
  });
});
