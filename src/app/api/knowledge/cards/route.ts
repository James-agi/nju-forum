import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireKnowledgeAuthor } from "@/lib/knowledge/authz";
import {
  cardCreateSchema,
  formatValidationError,
  getPagination,
} from "@/lib/knowledge/validation";
import {
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
  type KnowledgeCardDTO,
} from "@/lib/knowledge/types";

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
    domainTag: card.domainTag,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

export async function GET(req: Request) {
  try {
    const authz = await requireKnowledgeAuthor();
    if (!authz.ok) return authz.response;

    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = getPagination(searchParams);
    const q = searchParams.get("q")?.trim();
    const domainTag = searchParams.get("domainTag")?.trim();
    const verificationStatus = searchParams.get("verificationStatus")?.trim();

    const where: Prisma.KnowledgeCardWhereInput = {
      archivedAt: null,
    };

    if (q) {
      where.OR = [
        { summary: { contains: q, mode: "insensitive" } },
        { body: { contains: q, mode: "insensitive" } },
        { domainTag: { contains: q, mode: "insensitive" } },
        { sourceDescription: { contains: q, mode: "insensitive" } },
      ];
    }

    if (domainTag) {
      where.domainTag = { contains: domainTag, mode: "insensitive" };
    }

    if (
      verificationStatus &&
      VERIFICATION_STATUSES.includes(verificationStatus as (typeof VERIFICATION_STATUSES)[number])
    ) {
      where.verificationStatus = verificationStatus as (typeof VERIFICATION_STATUSES)[number];
    }

    const [cards, total] = await Promise.all([
      db.knowledgeCard.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      db.knowledgeCard.count({ where }),
    ]);

    return NextResponse.json({
      cards: cards.map(toCardDTO),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching knowledge cards:", error);
    return NextResponse.json({ error: "获取知识卡片失败" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authz = await requireKnowledgeAuthor();
    if (!authz.ok) return authz.response;

    const payload = await req.json();
    const parsed = cardCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatValidationError(parsed.error) },
        { status: 400 }
      );
    }

    if (!SOURCE_TYPES.includes(parsed.data.sourceType)) {
      return NextResponse.json({ error: "来源类型无效" }, { status: 400 });
    }

    const card = await db.knowledgeCard.create({
      data: {
        ...parsed.data,
        sourceUrl: parsed.data.sourceUrl ?? null,
        createdById: authz.user.id,
      },
    });

    return NextResponse.json(toCardDTO(card));
  } catch (error) {
    console.error("Error creating knowledge card:", error);
    return NextResponse.json({ error: "创建知识卡片失败" }, { status: 500 });
  }
}
