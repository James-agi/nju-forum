import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireKnowledgeAuthor } from "@/lib/knowledge/authz";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authz = await requireKnowledgeAuthor();
  if (!authz.ok) return authz.response;

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 100);
  const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
  const status = url.searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status && ["ANSWERED", "GAP_RECORDED", "OUT_OF_SCOPE"].includes(status)) {
    where.status = status;
  }

  try {
    const [questions, total] = await Promise.all([
      db.knowledgeQuestion.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          originalText: true,
          normalizedText: true,
          status: true,
          trace: true,
          createdAt: true,
          answer: {
            select: { answerMode: true },
          },
        },
      }),
      db.knowledgeQuestion.count({ where }),
    ]);

    const traces = questions.map((q) => {
      let trace = null;
      try {
        trace = q.trace ? JSON.parse(q.trace) : null;
      } catch {
        // invalid JSON
      }
      return {
        id: q.id,
        originalText: q.originalText,
        normalizedText: q.normalizedText,
        status: q.status,
        answerMode: q.answer?.answerMode ?? null,
        trace,
        createdAt: q.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      traces,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching admin traces:", error);
    return NextResponse.json({ error: "获取追踪记录失败" }, { status: 500 });
  }
}
