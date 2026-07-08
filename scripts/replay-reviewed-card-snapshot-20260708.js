#!/usr/bin/env node
require("dotenv/config");

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const DEFAULT_SNAPSHOT = path.join(__dirname, "temp-backups", "reviewed-card-current-snapshot-20260708.json");

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  const snapshotArg = process.argv.find((arg) => arg.startsWith("--snapshot="));
  return {
    apply: args.has("--apply"),
    includeArchived: args.has("--include-archived"),
    snapshot: snapshotArg ? path.resolve(snapshotArg.slice("--snapshot=".length)) : DEFAULT_SNAPSHOT,
  };
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function main() {
  const options = parseArgs();
  const snapshot = JSON.parse(fs.readFileSync(options.snapshot, "utf8"));
  if (!Array.isArray(snapshot.cards)) throw new Error("Snapshot must contain a cards array");

  const sourceCards = options.includeArchived
    ? snapshot.cards
    : snapshot.cards.filter((card) => !card.archivedAt);
  const ids = sourceCards.map((card) => card.id);
  const currentCards = await prisma.knowledgeCard.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      summary: true,
      body: true,
      sourceExcerpt: true,
      sourceUrl: true,
      sourceDescription: true,
      sourceType: true,
      verificationStatus: true,
      domainTag: true,
      archivedAt: true,
      sourceUrls: true,
    },
  });
  const currentById = new Map(currentCards.map((card) => [card.id, card]));

  const updates = [];
  const missing = [];
  const skippedArchived = [];

  for (const card of sourceCards) {
    const current = currentById.get(card.id);
    if (!current) {
      missing.push({ id: card.id, summary: card.summary });
      continue;
    }
    if (current.archivedAt && !options.includeArchived) {
      skippedArchived.push({ id: card.id, summary: current.summary });
      continue;
    }

    const data = {
      summary: card.summary,
      body: card.body,
      sourceExcerpt: card.sourceExcerpt,
      sourceUrl: card.sourceUrl,
      sourceDescription: card.sourceDescription,
      sourceType: card.sourceType,
      verificationStatus: card.verificationStatus,
      domainTag: card.domainTag,
      sourceUrls: card.sourceUrls,
    };

    const changedFields = Object.entries(data)
      .filter(([field, value]) => compact(current[field]) !== compact(value))
      .map(([field]) => field);
    if (!changedFields.length) continue;
    updates.push({ id: card.id, summary: card.summary, changedFields, data });
  }

  if (options.apply) {
    for (const update of updates) {
      await prisma.knowledgeCard.update({ where: { id: update.id }, data: update.data });
    }
  }

  console.log(JSON.stringify({
    mode: options.apply ? "APPLY" : "DRY_RUN",
    snapshot: options.snapshot,
    snapshotExportedAt: snapshot.exportedAt,
    sourceCards: sourceCards.length,
    currentCards: currentCards.length,
    updates: updates.length,
    missing,
    skippedArchived,
    sampleUpdates: updates.slice(0, 20).map(({ id, summary, changedFields }) => ({ id, summary, changedFields })),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
