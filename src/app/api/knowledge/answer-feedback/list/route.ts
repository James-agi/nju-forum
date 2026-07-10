import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireKnowledgeAuthor } from "@/lib/knowledge/authz";

export const dynamic = "force-dynamic";

interface FeedbackGroupRow {
  questionId: string;
  count: number;
  lastFeedbackAt: Date | null;
}

interface FeedbackNoteRow {
  questionId: string;
  note: string | null;
  createdAt: Date;
}

export async function GET() {
  try {
    const authz = await requireKnowledgeAuthor();
    if (!authz.ok) return authz.response;

    const grouped = await db.$queryRaw<FeedbackGroupRow[]>`
      SELECT
        "questionId",
        COUNT(*)::int AS "count",
        MAX("createdAt") AS "lastFeedbackAt"
      FROM "KnowledgeAnswerFeedback"
      WHERE "archivedAt" IS NULL
      GROUP BY "questionId"
      ORDER BY MAX("createdAt") DESC
    `;

    const questionIds = grouped.map((row) => row.questionId);
    const questions = await db.knowledgeQuestion.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, originalText: true },
    });
    const questionMap = new Map(questions.map((q) => [q.id, q.originalText]));

    const notes =
      questionIds.length > 0
        ? await db.$queryRaw<FeedbackNoteRow[]>`
            SELECT "questionId", "note", "createdAt"
            FROM "KnowledgeAnswerFeedback"
            WHERE "questionId" IN (${Prisma.join(questionIds)})
              AND "note" IS NOT NULL
              AND "archivedAt" IS NULL
            ORDER BY "createdAt" DESC
          `
        : [];

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
      count: row.count,
      lastFeedbackAt: row.lastFeedbackAt?.toISOString() ?? null,
      notes: notesByQuestion.get(row.questionId) ?? [],
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching answer feedback:", error);
    return NextResponse.json({ error: "获取反馈失败" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const authz = await requireKnowledgeAuthor();
    if (!authz.ok) return authz.response;

    const payload = await req.json();
    const questionId = typeof payload?.questionId === "string" ? payload.questionId.trim() : "";

    if (!questionId) {
      return NextResponse.json({ error: "缺少 questionId" }, { status: 400 });
    }

    const archivedCount = await db.$executeRaw`
      UPDATE "KnowledgeAnswerFeedback"
      SET "archivedAt" = NOW()
      WHERE "questionId" = ${questionId}
        AND "archivedAt" IS NULL
    `;

    if (archivedCount === 0) {
      return NextResponse.json({ error: "没有可归档的反馈" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, archivedCount });
  } catch (error) {
    console.error("Error archiving answer feedback:", error);
    return NextResponse.json({ error: "归档反馈失败" }, { status: 500 });
  }
}
