import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireKnowledgeAuthor } from "@/lib/knowledge/authz";

export const dynamic = "force-dynamic";

export async function GET() {
  const authz = await requireKnowledgeAuthor();
  if (!authz.ok) return authz.response;

  try {
    const rows = await db.$queryRawUnsafe<
      Array<{
        hour: string;
        total: bigint;
        fallback: bigint;
      }>
    >(
      `SELECT
         DATE_TRUNC('hour', q."createdAt") as hour,
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE a."answerMode" = 'FALLBACK') as fallback
       FROM "KnowledgeQuestion" q
       LEFT JOIN "KnowledgeAnswer" a ON a."questionId" = q.id
       WHERE q."createdAt" > NOW() - INTERVAL '7 days'
       GROUP BY DATE_TRUNC('hour', q."createdAt")
       ORDER BY hour DESC
       LIMIT 168`,
    );

    const hours = rows.map((r) => ({
      hour: r.hour,
      total: Number(r.total),
      fallback: Number(r.fallback),
      degradationRate: Number(r.total) > 0 ? Number(r.fallback) / Number(r.total) : 0,
    }));

    return NextResponse.json({ hours });
  } catch (error) {
    console.error("Error fetching degradation stats:", error);
    return NextResponse.json({ error: "获取降级率数据失败" }, { status: 500 });
  }
}
