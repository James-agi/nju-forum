import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireKnowledgeAuthor, requireKnowledgeUser } from "@/lib/knowledge/authz";
import {
  cardUpdateSchema,
  formatValidationError,
} from "@/lib/knowledge/validation";
import type { KnowledgeCardDTO } from "@/lib/knowledge/types";
import { computeAndStoreEmbedding } from "@/lib/knowledge/embedding-refresh";
import { answerCache } from "@/lib/knowledge/cache";

export const dynamic = "force-dynamic";

function toCardDTO(card: {
  id: string;
  summary: string;
  body: string;
  sourceExcerpt: string | null;
  sourceUrl: string | null;
  sourceDescription: string;
  sourceType: KnowledgeCardDTO["sourceType"];
  verificationStatus: KnowledgeCardDTO["verificationStatus"];
  verifiedAt: Date | null;
  domainTag: string;
  createdAt: Date;
  updatedAt: Date;
}): KnowledgeCardDTO {
  return {
    id: card.id,
    summary: card.summary,
    body: card.body,
    sourceExcerpt: card.sourceExcerpt,
    sourceUrl: card.sourceUrl,
    sourceDescription: card.sourceDescription,
    sourceType: card.sourceType,
    verificationStatus: card.verificationStatus,
    verifiedAt: card.verifiedAt?.toISOString() ?? null,
    domainTag: card.domainTag,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authz = await requireKnowledgeUser();
    if (!authz.ok) return authz.response;

    const card = await db.knowledgeCard.findFirst({
      where: { id: params.id, archivedAt: null },
    });

    if (!card) {
      return NextResponse.json({ error: "知识卡片不存在" }, { status: 404 });
    }

    return NextResponse.json(toCardDTO(card));
  } catch (error) {
    console.error("Error fetching knowledge card:", error);
    return NextResponse.json({ error: "获取知识卡片失败" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authz = await requireKnowledgeAuthor();
    if (!authz.ok) return authz.response;

    const payload = await req.json();
    const parsed = cardUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatValidationError(parsed.error) },
        { status: 400 }
      );
    }

    // 先检查卡片是否存在且未被归档
    const existing = await db.knowledgeCard.findFirst({
      where: { id: params.id, archivedAt: null },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "知识卡片不存在" }, { status: 404 });
    }

    const hasSourceUrl = Object.prototype.hasOwnProperty.call(payload, "sourceUrl");
    const { archive, sourceUrls, ...fields } = parsed.data;

    const before = await db.knowledgeCard.findUnique({
      where: { id: params.id },
      select: { summary: true, body: true, domainTag: true, verificationStatus: true },
    });
    const verificationStatusChanged =
      fields.verificationStatus !== undefined &&
      fields.verificationStatus !== before?.verificationStatus;
    const verificationSensitiveFieldsChanged =
      fields.summary !== undefined ||
      fields.body !== undefined ||
      fields.sourceExcerpt !== undefined ||
      hasSourceUrl ||
      sourceUrls !== undefined ||
      fields.sourceDescription !== undefined ||
      fields.sourceType !== undefined ||
      fields.domainTag !== undefined;
    const nextVerificationStatus =
      fields.verificationStatus ?? before?.verificationStatus;

    const card = await db.knowledgeCard.update({
      where: { id: params.id },
      data: {
        ...fields,
        sourceUrls: sourceUrls ? JSON.stringify(sourceUrls) : undefined,
        sourceUrl: hasSourceUrl ? fields.sourceUrl ?? null : undefined,
        verifiedAt:
          verificationStatusChanged || verificationSensitiveFieldsChanged
          ? nextVerificationStatus === "VERIFIED"
            ? new Date()
            : null
          : undefined,
        updatedById: authz.user.id,
        archivedAt:
          archive === true ? new Date() : archive === false ? null : undefined,
      },
    });

    // body 或 summary 变化时重算 embedding + 记录修订
    if (fields.body !== undefined || fields.summary !== undefined) {
      computeAndStoreEmbedding(card.id, card.summary, card.body, card.domainTag)
        .catch((err) => console.warn("[embedding] async recompute failed:", err));

      db.knowledgeCardRevision.create({
        data: {
          cardId: card.id,
          summary: before?.summary ?? "",
          body: before?.body ?? "",
          changedBy: authz.user.id,
        },
      }).catch((err) => console.warn("[revision] create failed:", err));
    }

    answerCache.invalidateAll();

    return NextResponse.json(toCardDTO(card));
  } catch (error) {
    console.error("Error updating knowledge card:", error);
    return NextResponse.json({ error: "更新知识卡片失败" }, { status: 500 });
  }
}
