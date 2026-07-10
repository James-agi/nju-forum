#!/usr/bin/env node
require("dotenv/config");

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const cards = await prisma.knowledgeCard.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      summary: true,
      body: true,
      sourceExcerpt: true,
      sourceUrl: true,
      sourceDescription: true,
      sourceType: true,
      verificationStatus: true,
      verifiedAt: true,
      updatedAt: true,
      domainTag: true,
      archivedAt: true,
      sourceUrls: true,
    },
  });

  const normalizedCards = cards.map(({ updatedAt, ...card }) => ({
    ...card,
    verifiedAt:
      card.verificationStatus === "VERIFIED"
        ? card.verifiedAt || updatedAt
        : card.verifiedAt,
  }));

  const outDir = path.join(__dirname, "..", "prisma", "seed-data");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "knowledge-cards-current.json");
  fs.writeFileSync(
    outFile,
    JSON.stringify({
      exportedAt: new Date().toISOString(),
      source: "current KnowledgeCard table",
      count: normalizedCards.length,
      cards: normalizedCards,
    }, null, 2),
    "utf8",
  );
  console.log(JSON.stringify({ outFile, count: normalizedCards.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
