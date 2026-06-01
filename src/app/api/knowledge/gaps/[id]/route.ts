import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireKnowledgeAuthor } from "@/lib/knowledge/authz";
import {
  formatValidationError,
  gapUpdateSchema,
} from "@/lib/knowledge/validation";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authz = await requireKnowledgeAuthor();
    if (!authz.ok) return authz.response;

    const payload = await req.json();
    const parsed = gapUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatValidationError(parsed.error) },
        { status: 400 }
      );
    }

    const existingGap = await db.knowledgeGap.findUnique({
      where: { id: params.id },
    });

    if (!existingGap) {
      return NextResponse.json({ error: "缺口不存在" }, { status: 404 });
    }

    if (parsed.data.status === "HANDLED") {
      const linkedCard = await db.knowledgeCard.findFirst({
        where: { id: parsed.data.linkedCardId, archivedAt: null },
        select: { id: true },
      });

      if (!linkedCard) {
        return NextResponse.json({ error: "关联卡片不存在或已归档" }, { status: 400 });
      }
    }

    if (parsed.data.status === "DUPLICATE") {
      if (parsed.data.duplicateOfId === params.id) {
        return NextResponse.json({ error: "不能把缺口标记为自身重复" }, { status: 400 });
      }

      const duplicateOf = await db.knowledgeGap.findUnique({
        where: { id: parsed.data.duplicateOfId },
        select: { id: true },
      });

      if (!duplicateOf) {
        return NextResponse.json({ error: "重复来源缺口不存在" }, { status: 400 });
      }
    }

    const data: {
      gapType?: (typeof parsed.data)["gapType"];
      status?: (typeof parsed.data)["status"];
      handledById?: string;
      handledAt?: Date;
      linkedCardId?: string | null;
      duplicateOfId?: string | null;
    } = {};

    if (parsed.data.gapType !== undefined) {
      data.gapType = parsed.data.gapType;
    }

    if (parsed.data.status !== undefined) {
      data.status = parsed.data.status;
      data.handledById = authz.user.id;
      data.handledAt = new Date();
      data.linkedCardId =
        parsed.data.status === "HANDLED" ? parsed.data.linkedCardId : null;
      data.duplicateOfId =
        parsed.data.status === "DUPLICATE" ? parsed.data.duplicateOfId : null;
    }

    const gap = await db.knowledgeGap.update({
      where: { id: params.id },
      data,
      include: {
        linkedCard: { select: { summary: true } },
      },
    });

    return NextResponse.json({
      id: gap.id,
      originalQuestion: gap.originalQuestion,
      status: gap.status,
      gapType: gap.gapType,
      linkedCardId: gap.linkedCardId,
      linkedCardSummary: gap.linkedCard?.summary ?? null,
      duplicateOfId: gap.duplicateOfId,
      createdAt: gap.createdAt.toISOString(),
      updatedAt: gap.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error updating knowledge gap:", error);
    return NextResponse.json({ error: "更新缺口失败" }, { status: 500 });
  }
}
