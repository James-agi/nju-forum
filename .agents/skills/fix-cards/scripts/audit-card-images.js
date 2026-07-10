#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }
  return args;
}

function loadPrismaClient() {
  const cwd = process.cwd();
  const packageJsonPath = path.join(cwd, "package.json");
  const req = createRequire(fs.existsSync(packageJsonPath) ? packageJsonPath : __filename);
  const { PrismaClient } = req("@prisma/client");
  return new PrismaClient();
}

function extractImagePaths(sourceExcerpt) {
  const matches = String(sourceExcerpt || "").matchAll(/\((\/knowledge-images\/[^)\s]+)\)/g);
  const seen = new Set();
  const images = [];

  for (const match of matches) {
    const imagePath = match[1];
    if (seen.has(imagePath)) continue;
    seen.add(imagePath);
    images.push(imagePath);
  }

  return images;
}

function printCardHeader(card) {
  console.log("=== Card ===");
  console.log(`ID: ${card.id}`);
  console.log(`summary: ${card.summary}`);
  console.log(`sourceUrl: ${card.sourceUrl || "(empty)"}`);
  console.log(`sourceDescription: ${card.sourceDescription || "(empty)"}`);
  console.log(`verificationStatus: ${card.verificationStatus}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.id && !args.summary) {
    console.error("Usage: node audit-card-images.js --id <card-id> or --summary <keyword>");
    process.exit(1);
  }

  const prisma = loadPrismaClient();

  try {
    let cards = [];

    if (args.id) {
      const card = await prisma.knowledgeCard.findUnique({
        where: { id: args.id },
        select: {
          id: true,
          summary: true,
          sourceUrl: true,
          sourceDescription: true,
          verificationStatus: true,
          sourceExcerpt: true,
        },
      });
      if (card) cards = [card];
    } else {
      cards = await prisma.knowledgeCard.findMany({
        where: {
          archivedAt: null,
          OR: [
            { summary: { contains: args.summary, mode: "insensitive" } },
            { body: { contains: args.summary, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          summary: true,
          sourceUrl: true,
          sourceDescription: true,
          verificationStatus: true,
          sourceExcerpt: true,
        },
        take: 10,
        orderBy: { createdAt: "asc" },
      });
    }

    if (cards.length === 0) {
      console.error("No matching cards found.");
      process.exit(1);
    }

    for (const [cardIndex, card] of cards.entries()) {
      if (cardIndex > 0) console.log("");
      printCardHeader(card);

      const images = extractImagePaths(card.sourceExcerpt);
      console.log(`imageCount: ${images.length}`);

      const siblings = card.sourceUrl
        ? await prisma.knowledgeCard.findMany({
            where: {
              archivedAt: null,
              sourceUrl: card.sourceUrl,
            },
            select: {
              id: true,
              summary: true,
            },
            orderBy: { createdAt: "asc" },
          })
        : [];

      if (siblings.length > 0) {
        console.log("same-source cards:");
        for (const sibling of siblings) {
          console.log(`- ${sibling.id} | ${sibling.summary}`);
        }
      }

      if (images.length === 0) {
        console.log("No local image references in sourceExcerpt.");
        continue;
      }

      let crossSourceCount = 0;

      for (const imagePath of images) {
        const refs = await prisma.knowledgeCard.findMany({
          where: {
            archivedAt: null,
            sourceExcerpt: { contains: imagePath },
          },
          select: {
            id: true,
            summary: true,
            sourceUrl: true,
          },
          orderBy: { createdAt: "asc" },
        });

        const crossSourceRefs = refs.filter(
          (ref) => (ref.sourceUrl || null) !== (card.sourceUrl || null),
        );

        if (crossSourceRefs.length > 0) {
          crossSourceCount += 1;
        }

        console.log("");
        console.log(`image: ${imagePath}`);
        console.log(`referencedBy: ${refs.length} card(s)`);
        for (const ref of refs) {
          const tag =
            (ref.sourceUrl || null) === (card.sourceUrl || null) ? "[same-source]" : "[cross-source]";
          console.log(`- ${tag} ${ref.id} | ${ref.summary} | ${ref.sourceUrl || "(empty)"}`);
        }
      }

      console.log("");
      if (crossSourceCount > 0) {
        console.log(
          `WARNING: ${crossSourceCount}/${images.length} image(s) are reused across sourceUrl values.`,
        );
      } else {
        console.log("No cross-source image reuse found.");
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
