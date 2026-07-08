import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireKnowledgeAuthor, requireKnowledgeUser } from "@/lib/knowledge/authz";
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
import { computeAndStoreEmbedding } from "@/lib/knowledge/embedding-refresh";
import { answerCache } from "@/lib/knowledge/cache";

export const dynamic = "force-dynamic";

const KNOWLEDGE_CARD_LIST_SELECT = {
  id: true,
  summary: true,
  body: true,
  sourceExcerpt: true,
  sourceUrl: true,
  sourceDescription: true,
  sourceType: true,
  verificationStatus: true,
  verifiedAt: true,
  domainTag: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.KnowledgeCardSelect;

type KnowledgeCardListRecord = Prisma.KnowledgeCardGetPayload<{
  select: typeof KNOWLEDGE_CARD_LIST_SELECT;
}> & {
  summary: string | null;
  body: string | null;
  sourceDescription: string | null;
  sourceType: string | null;
  verificationStatus: string | null;
  domainTag: string | null;
  verifiedAt: Date | string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

interface KnowledgeCardListFilters {
  q?: string;
  domainTag?: string;
  verificationStatus?: string;
}

function toDate(value: Date | string | null | undefined) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function toIsoString(value: Date | string | null | undefined, fallback: Date) {
  return toDate(value)?.toISOString() ?? fallback.toISOString();
}

function normalizeSourceType(value: string | null): KnowledgeCardDTO["sourceType"] {
  return SOURCE_TYPES.includes(value as KnowledgeCardDTO["sourceType"])
    ? (value as KnowledgeCardDTO["sourceType"])
    : "OTHER";
}

function normalizeVerificationStatus(
  value: string | null
): KnowledgeCardDTO["verificationStatus"] {
  return VERIFICATION_STATUSES.includes(value as KnowledgeCardDTO["verificationStatus"])
    ? (value as KnowledgeCardDTO["verificationStatus"])
    : "NEEDS_REVIEW";
}

function toCardDTO(card: KnowledgeCardListRecord): KnowledgeCardDTO {
  const createdAt = toDate(card.createdAt) ?? new Date(0);
  const updatedAt = toDate(card.updatedAt) ?? createdAt;

  return {
    id: card.id,
    summary: card.summary ?? "未命名知识卡片",
    body: card.body ?? "",
    sourceExcerpt: card.sourceExcerpt,
    sourceUrl: card.sourceUrl,
    sourceDescription: card.sourceDescription ?? "来源说明缺失",
    sourceType: normalizeSourceType(card.sourceType),
    verificationStatus: normalizeVerificationStatus(card.verificationStatus),
    verifiedAt: card.verifiedAt ? toIsoString(card.verifiedAt, updatedAt) : null,
    domainTag: card.domainTag ?? "其他",
    createdAt: toIsoString(createdAt, new Date(0)),
    updatedAt: toIsoString(updatedAt, createdAt),
  };
}

function buildKnowledgeCardWhereSql(filters: KnowledgeCardListFilters) {
  const clauses = [Prisma.sql`"archivedAt" IS NULL`];

  if (filters.q) {
    const pattern = `%${filters.q}%`;
    clauses.push(Prisma.sql`(
      "summary" ILIKE ${pattern}
      OR "body" ILIKE ${pattern}
      OR "domainTag" ILIKE ${pattern}
      OR "sourceDescription" ILIKE ${pattern}
    )`);
  }

  if (filters.domainTag) {
    clauses.push(Prisma.sql`"domainTag" ILIKE ${`%${filters.domainTag}%`}`);
  }

  if (
    filters.verificationStatus &&
    VERIFICATION_STATUSES.includes(
      filters.verificationStatus as KnowledgeCardDTO["verificationStatus"]
    )
  ) {
    clauses.push(Prisma.sql`"verificationStatus"::text = ${filters.verificationStatus}`);
  }

  return Prisma.sql`${Prisma.join(clauses, " AND ")}`;
}

async function findKnowledgeCards(
  where: Prisma.KnowledgeCardWhereInput,
  filters: KnowledgeCardListFilters,
  skip: number,
  limit: number
) {
  try {
    return await db.knowledgeCard.findMany({
      where,
      select: KNOWLEDGE_CARD_LIST_SELECT,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip,
      take: limit,
    });
  } catch (error) {
    console.warn("[knowledge-cards] Prisma list query failed, using raw fallback:", error);
    const whereSql = buildKnowledgeCardWhereSql(filters);

    return db.$queryRaw<KnowledgeCardListRecord[]>`
      SELECT
        "id",
        "summary",
        "body",
        "sourceExcerpt",
        "sourceUrl",
        "sourceDescription",
        "sourceType"::text AS "sourceType",
        "verificationStatus"::text AS "verificationStatus",
        "verifiedAt",
        "domainTag",
        "createdAt",
        "updatedAt"
      FROM "KnowledgeCard"
      WHERE ${whereSql}
      ORDER BY "updatedAt" DESC NULLS LAST, "id" DESC
      OFFSET ${skip}
      LIMIT ${limit}
    `;
  }
}

export async function GET(req: Request) {
  try {
    const authz = await requireKnowledgeUser();
    if (!authz.ok) return authz.response;

    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = getPagination(searchParams);
    const q = searchParams.get("q")?.trim();
    const domainTag = searchParams.get("domainTag")?.trim();
    const verificationStatus = searchParams.get("verificationStatus")?.trim();

    const baseWhere: Prisma.KnowledgeCardWhereInput = {
      archivedAt: null,
    };

    if (q) {
      baseWhere.OR = [
        { summary: { contains: q, mode: "insensitive" } },
        { body: { contains: q, mode: "insensitive" } },
        { domainTag: { contains: q, mode: "insensitive" } },
        { sourceDescription: { contains: q, mode: "insensitive" } },
      ];
    }

    if (domainTag) {
      baseWhere.domainTag = { contains: domainTag, mode: "insensitive" };
    }

    const where: Prisma.KnowledgeCardWhereInput = { ...baseWhere };
    if (
      verificationStatus &&
      VERIFICATION_STATUSES.includes(verificationStatus as (typeof VERIFICATION_STATUSES)[number])
    ) {
      where.verificationStatus = verificationStatus as (typeof VERIFICATION_STATUSES)[number];
    }

    const filters = { q, domainTag, verificationStatus };
    const [cards, total, groupedStatusCounts] = await Promise.all([
      findKnowledgeCards(where, filters, skip, limit),
      db.knowledgeCard.count({ where }),
      db.knowledgeCard.groupBy({
        by: ["verificationStatus"],
        where: baseWhere,
        _count: { _all: true },
      }),
    ]);

    const statusCounts = Object.fromEntries(
      VERIFICATION_STATUSES.map((status) => [
        status,
        groupedStatusCounts.find((item) => item.verificationStatus === status)?._count._all ?? 0,
      ])
    );

    return NextResponse.json({
      cards: cards.map(toCardDTO),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      statusCounts,
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

    // 铁律：AI 起草的卡片不允许自己标 VERIFIED，强制压回 NEEDS_REVIEW，只有作者人工编辑才能升级
    const draftedByAi = (payload as { draftedByAi?: unknown })?.draftedByAi === true;
    const verificationStatus = draftedByAi
      ? "NEEDS_REVIEW"
      : parsed.data.verificationStatus;

    const sourceUrls = parsed.data.sourceUrls
      || (parsed.data.sourceUrl ? [parsed.data.sourceUrl] : null);

    const card = await db.knowledgeCard.create({
      data: {
        ...parsed.data,
        sourceUrls: sourceUrls ? JSON.stringify(sourceUrls) : null,
        verificationStatus,
        verifiedAt: verificationStatus === "VERIFIED" ? new Date() : null,
        sourceUrl: parsed.data.sourceUrl ?? null,
        createdById: authz.user.id,
      },
    });

    computeAndStoreEmbedding(card.id, card.summary, card.body, card.domainTag)
      .catch((err) => console.warn("[embedding] async compute failed:", err));

    answerCache.invalidateAll();

    return NextResponse.json(toCardDTO(card));
  } catch (error) {
    console.error("Error creating knowledge card:", error);
    return NextResponse.json({ error: "创建知识卡片失败" }, { status: 500 });
  }
}
