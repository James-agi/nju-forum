import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOrCreateConversation, getConversationHistory } from "../conversation";

const mockFindFirst = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: {
    knowledgeConversation: {
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
    },
    knowledgeQuestion: {
      findMany: mockFindMany,
      findFirst: vi.fn(),
    },
  },
}));

describe("getOrCreateConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates new conversation when no conversationId given", async () => {
    mockCreate.mockResolvedValue({
      id: "conv-1",
      userId: "user-1",
      isActive: true,
      expiresAt: new Date(Date.now() + 1800000),
      createdAt: new Date(),
    });

    const result = await getOrCreateConversation("user-1");
    expect(result.conversationId).toBe("conv-1");
    expect(result.turnIndex).toBe(1);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1" }),
    });
  });

  it("reuses existing active conversation", async () => {
    const future = new Date(Date.now() + 60000);
    mockFindFirst.mockResolvedValue({
      id: "conv-1",
      userId: "user-1",
      isActive: true,
      expiresAt: future,
    });
    const mockTurnFind = vi.fn().mockResolvedValue({ turnIndex: 2 });
    const { db } = await import("@/lib/db");
    db.knowledgeQuestion.findFirst = mockTurnFind;
    mockUpdate.mockResolvedValue({});

    const result = await getOrCreateConversation("user-1", "conv-1");
    expect(result.conversationId).toBe("conv-1");
    expect(result.turnIndex).toBe(3);
  });

  it("creates new conversation when existing is expired or not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "conv-2",
      userId: "user-1",
      isActive: true,
      expiresAt: new Date(Date.now() + 1800000),
      createdAt: new Date(),
    });

    const result = await getOrCreateConversation("user-1", "expired-id");
    expect(result.conversationId).toBe("conv-2");
    expect(mockCreate).toHaveBeenCalled();
  });
});

describe("getConversationHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns recent turns in chronological order", async () => {
    mockFindMany.mockResolvedValue([
      {
        originalText: "第二问",
        turnIndex: 2,
        answer: { answerText: "第二答" },
      },
      {
        originalText: "第一问",
        turnIndex: 1,
        answer: { answerText: "第一答" },
      },
    ]);

    const history = await getConversationHistory("conv-1", 3);
    expect(history).toHaveLength(2);
    expect(history[0].question).toBe("第一问");
    expect(history[1].answer).toBe("第二答");
  });

  it("returns empty array when no answered turns", async () => {
    mockFindMany.mockResolvedValue([]);
    const history = await getConversationHistory("conv-1");
    expect(history).toEqual([]);
  });
});
