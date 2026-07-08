import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RetrievalResult } from "../types-internal";

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
      makeCard({ id: "c1", summary: "\u8f6c\u4e13\u4e1a\u6d41\u7a0b", body: "\u8f6c\u4e13\u4e1a\u9700\u8981\u7ee9\u70b9\u524d30%" }),
      makeCard({ id: "c2", summary: "\u9009\u8bfe\u6307\u5357", body: "\u9009\u8bfe\u7cfb\u7edf" }),
    ];
    db.knowledgeCard.findMany.mockResolvedValue(cards);

    const { retrieveKnowledgeCards } = await importRetrieval();
    const results = await retrieveKnowledgeCards(TRANSFER_QUESTION);

    expect(db.knowledgeCard.findMany).toHaveBeenCalledTimes(1);
    const callArgs = db.knowledgeCard.findMany.mock.calls[0][0];
    expect(callArgs.where.OR.length).toBeGreaterThan(0);
    expect(callArgs.take).toBe(50);
    expect(callArgs.orderBy).toEqual([{ verificationStatus: "asc" }, { updatedAt: "desc" }]);

    expect(results.length).toBe(1);
    expect(results[0].card.id).toBe("c1");
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].queryTerms).toEqual([TRANSFER]);
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
