import { db } from "@/lib/db";

const CONVERSATION_TTL_MS = 30 * 60 * 1000;

export async function getOrCreateConversation(
  userId: string,
  conversationId?: string,
): Promise<{ conversationId: string; turnIndex: number }> {
  if (conversationId) {
    const existing = await db.knowledgeConversation.findFirst({
      where: { id: conversationId, userId, isActive: true, expiresAt: { gt: new Date() } },
    });

    if (existing) {
      await db.knowledgeConversation.update({
        where: { id: existing.id },
        data: { expiresAt: new Date(Date.now() + CONVERSATION_TTL_MS) },
      });

      const lastTurn = await db.knowledgeQuestion.findFirst({
        where: { conversationId: existing.id },
        orderBy: { turnIndex: "desc" },
        select: { turnIndex: true },
      });

      return { conversationId: existing.id, turnIndex: (lastTurn?.turnIndex ?? 0) + 1 };
    }
  }

  const newId = `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const conversation = await db.knowledgeConversation.create({
    data: { id: newId, userId, updatedAt: new Date(), expiresAt: new Date(Date.now() + CONVERSATION_TTL_MS) },
  });

  return { conversationId: conversation.id, turnIndex: 1 };
}

export async function getConversationHistory(
  conversationId: string,
  maxTurns = 3,
): Promise<Array<{ question: string; answer: string }>> {
  const questions = await db.knowledgeQuestion.findMany({
    where: { conversationId, status: "ANSWERED" },
    orderBy: { turnIndex: "desc" },
    take: maxTurns,
    include: { answer: { select: { answerText: true } } },
  });

  return questions
    .reverse()
    .map((q) => ({
      question: q.originalText,
      answer: q.answer?.answerText ?? "",
    }));
}
