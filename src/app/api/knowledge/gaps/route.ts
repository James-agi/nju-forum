import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireKnowledgeAuthor } from "@/lib/knowledge/authz";
import { getPagination } from "@/lib/knowledge/validation";
import {
  GAP_STATUSES,
  type GapStatusValue,
  type GapTypeValue,
  type KnowledgeGapDTO,
} from "@/lib/knowledge/types";

export const dynamic = "force-dynamic";

const GAP_STATUS_RANK: Record<GapStatusValue, number> = {
  OPEN: 0,
  HANDLED: 1,
  DUPLICATE: 2,
  OUT_OF_SCOPE: 3,
};

function toGapDTO(gap: {
  id: string;
  originalQuestion: string;
  status: GapStatusValue;
  gapType: GapTypeValue;
  linkedCardId: string | null;
  linkedCard: { summary: string } | null;
  duplicateOfId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): KnowledgeGapDTO {
  return {
    id: gap.id,
    originalQuestion: gap.originalQuestion,
    status: gap.status,
    gapType: gap.gapType,
    linkedCardId: gap.linkedCardId,
    linkedCardSummary: gap.linkedCard?.summary ?? null,
    duplicateOfId: gap.duplicateOfId,
    createdAt: gap.createdAt.toISOString(),
    updatedAt: gap.updatedAt.toISOString(),
  };
}

export async function GET(req: Request) {
  try {
    const authz = await requireKnowledgeAuthor();
    if (!authz.ok) return authz.response;

    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = getPagination(searchParams);
    const status = searchParams.get("status")?.trim();
    const statusFilter =
      status && GAP_STATUSES.includes(status as GapStatusValue)
        ? (status as GapStatusValue)
        : undefined;

    const [allGaps, total] = await Promise.all([
      db.knowledgeGap.findMany({
        where: statusFilter ? { status: statusFilter } : undefined,
        include: {
          linkedCard: { select: { summary: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.knowledgeGap.count({
        where: statusFilter ? { status: statusFilter } : undefined,
      }),
    ]);

    const sorted = statusFilter
      ? allGaps
      : allGaps.sort((a, b) => {
          const byStatus = GAP_STATUS_RANK[a.status] - GAP_STATUS_RANK[b.status];
          if (byStatus !== 0) return byStatus;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });

    return NextResponse.json({
      gaps: sorted.slice(skip, skip + limit).map(toGapDTO),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching knowledge gaps:", error);
    return NextResponse.json({ error: "获取缺口库失败" }, { status: 500 });
  }
}
