import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireKnowledgeAuthor } from "@/lib/knowledge/authz";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authz = await requireKnowledgeAuthor();
  if (!authz.ok) return authz.response;

  const url = new URL(req.url);
  const questionId = url.searchParams.get("questionId");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 100);
  const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);

  if (questionId) {
    const question = await db.knowledgeQuestion.findUnique({
      where: { id: questionId },
      include: {
        answer: { include: { citations: true } },
        gap: true,
      },
    });

    if (!question) {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }

    let trace = null;
    try {
      trace = question.trace ? JSON.parse(question.trace) : null;
    } catch {
      // invalid JSON stored
    }

    return NextResponse.json({ question, trace, debug: true });
  }

  const [questions, total] = await Promise.all([
    db.knowledgeQuestion.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        answer: { include: { citations: true } },
        gap: true,
      },
    }),
    db.knowledgeQuestion.count(),
  ]);

  const questionsWithTrace = questions.map((q) => {
    let trace = null;
    try {
      trace = q.trace ? JSON.parse(q.trace) : null;
    } catch {
      // invalid JSON stored
    }
    return { ...q, trace };
  });

  return NextResponse.json({
    questions: questionsWithTrace,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
