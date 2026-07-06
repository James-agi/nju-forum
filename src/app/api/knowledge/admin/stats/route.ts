import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireKnowledgeAuthor } from "@/lib/knowledge/authz";
import { answerCache } from "@/lib/knowledge/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const authz = await requireKnowledgeAuthor();
  if (!authz.ok) return authz.response;

  try {
    const [totalQuestions, statusDistribution, answerModeDistribution, avgResponseTime] = await Promise.all([
      db.knowledgeQuestion.count(),
      db.knowledgeQuestion.groupBy({
        by: ["status"],
        _count: true,
      }),
      db.knowledgeAnswer.groupBy({
        by: ["answerMode"],
        _count: true,
      }),
      db.$queryRawUnsafe<Array<{ avg: number | null }>>(
        `SELECT AVG(EXTRACT(EPOCH FROM (a."createdAt" - q."createdAt")) * 1000) as avg
         FROM "KnowledgeAnswer" a
         JOIN "KnowledgeQuestion" q ON q.id = a."questionId"
         WHERE q."createdAt" > NOW() - INTERVAL '7 days'`,
      ),
    ]);

    const cacheStats = answerCache.stats();

    return NextResponse.json({
      totalQuestions,
      statusDistribution: Object.fromEntries(
        statusDistribution.map((s) => [s.status, s._count]),
      ),
      answerModeDistribution: Object.fromEntries(
        answerModeDistribution.map((a) => [a.answerMode, a._count]),
      ),
      avgResponseTimeMs: Math.round(avgResponseTime[0]?.avg ?? 0),
      cache: {
        size: cacheStats.size,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: cacheStats.hits + cacheStats.misses > 0
          ? Math.round((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100) / 100
          : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json({ error: "获取统计数据失败" }, { status: 500 });
  }
}
