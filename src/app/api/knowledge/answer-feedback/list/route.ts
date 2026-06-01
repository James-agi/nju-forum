import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireKnowledgeAuthor } from "@/lib/knowledge/authz";

export const dynamic = "force-dynamic";

export async function GET() {
  const authz = await requireKnowledgeAuthor();
  if (!authz.ok) return authz.response;

  const grouped = await db.knowledgeAnswerFeedback.groupBy({
    by: ["questionId"],
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
  });

  const questionIds = grouped.map((row) => row.questionId);
  const questions = await db.knowledgeQuestion.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, originalText: true },
  });
  const questionMap = new Map(questions.map((q) => [q.id, q.originalText]));
  const notes = await db.knowledgeAnswerFeedback.findMany({
    where: {
      questionId: { in: questionIds },
      note: { not: null },
    },
    select: {
      questionId: true,
      note: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const notesByQuestion = new Map<string, { text: string; createdAt: string }[]>();
  for (const item of notes) {
    if (!item.note) continue;
    const current = notesByQuestion.get(item.questionId) ?? [];
    current.push({
      text: item.note,
      createdAt: item.createdAt.toISOString(),
    });
    notesByQuestion.set(item.questionId, current);
  }

  const items = grouped.map((row) => ({
    questionId: row.questionId,
    questionText: questionMap.get(row.questionId) ?? "（问题已删除）",
    count: row._count._all,
    lastFeedbackAt: row._max.createdAt?.toISOString() ?? null,
    notes: notesByQuestion.get(row.questionId) ?? [],
  }));

  return NextResponse.json({ items });
}
