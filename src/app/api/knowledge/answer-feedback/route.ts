import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireKnowledgeUser } from "@/lib/knowledge/authz";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const authz = await requireKnowledgeUser();
    if (!authz.ok) return authz.response;

    const payload = await req.json();
    const questionId = typeof payload?.questionId === "string" ? payload.questionId.trim() : "";
    const trimmedNote =
      typeof payload?.note === "string" ? payload.note.trim().slice(0, 2000) : null;
    const note = trimmedNote ? trimmedNote : null;
    if (!questionId) {
      return NextResponse.json({ error: "缺少 questionId" }, { status: 400 });
    }

    const question = await db.knowledgeQuestion.findUnique({
      where: { id: questionId },
      select: { id: true, status: true },
    });

    if (!question || question.status !== "ANSWERED") {
      return NextResponse.json({ error: "该问题不存在或没有可反馈的回答" }, { status: 404 });
    }

    await db.knowledgeAnswerFeedback.upsert({
      where: {
        questionId_userId: {
          questionId,
          userId: authz.user.id,
        },
      },
      create: {
        questionId,
        userId: authz.user.id,
        note,
      },
      update: { note },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error recording answer feedback:", error);
    return NextResponse.json({ error: "反馈提交失败" }, { status: 500 });
  }
}
