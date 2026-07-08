import fs from "node:fs";
import path from "node:path";
import { PrismaClient, type SourceType, type VerificationStatus } from "@prisma/client";

const prisma = new PrismaClient();

interface CurrentSeedCard {
  id: string;
  summary: string;
  body: string;
  sourceExcerpt: string | null;
  sourceUrl: string | null;
  sourceDescription: string;
  sourceType: SourceType;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  domainTag: string;
  archivedAt: string | null;
  sourceUrls: string | null;
}

interface CurrentSeedPayload {
  exportedAt: string;
  source: string;
  count: number;
  cards: CurrentSeedCard[];
}

function loadSeedPayload(): CurrentSeedPayload {
  const file = path.join(__dirname, "seed-data", "knowledge-cards-current.json");
  return JSON.parse(fs.readFileSync(file, "utf8")) as CurrentSeedPayload;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const payload = loadSeedPayload();
  const author = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!author) {
    throw new Error("找不到 ADMIN 用户，请先运行 npm run db:seed 创建管理员账号");
  }

  const current = await prisma.knowledgeCard.findMany({
    where: { id: { in: payload.cards.map((card) => card.id) } },
    select: { id: true },
  });
  const existingIds = new Set(current.map((card) => card.id));
  const toCreate = payload.cards.filter((card) => !existingIds.has(card.id));
  const toUpdate = payload.cards.filter((card) => existingIds.has(card.id));

  if (apply) {
    for (const card of payload.cards) {
      await prisma.knowledgeCard.upsert({
        where: { id: card.id },
        update: {
          summary: card.summary,
          body: card.body,
          sourceExcerpt: card.sourceExcerpt,
          sourceUrl: card.sourceUrl,
          sourceDescription: card.sourceDescription,
          sourceType: card.sourceType,
          verificationStatus: card.verificationStatus,
          verifiedAt: card.verifiedAt ? new Date(card.verifiedAt) : null,
          domainTag: card.domainTag,
          archivedAt: card.archivedAt ? new Date(card.archivedAt) : null,
          sourceUrls: card.sourceUrls,
          updatedById: author.id,
        },
        create: {
          id: card.id,
          summary: card.summary,
          body: card.body,
          sourceExcerpt: card.sourceExcerpt,
          sourceUrl: card.sourceUrl,
          sourceDescription: card.sourceDescription,
          sourceType: card.sourceType,
          verificationStatus: card.verificationStatus,
          verifiedAt: card.verifiedAt ? new Date(card.verifiedAt) : null,
          domainTag: card.domainTag,
          archivedAt: card.archivedAt ? new Date(card.archivedAt) : null,
          sourceUrls: card.sourceUrls,
          createdById: author.id,
          updatedById: author.id,
        },
      });
    }
  }

  console.log(JSON.stringify({
    mode: apply ? "APPLY" : "DRY_RUN",
    exportedAt: payload.exportedAt,
    seedCount: payload.count,
    cardCount: payload.cards.length,
    createCount: toCreate.length,
    updateCount: toUpdate.length,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
