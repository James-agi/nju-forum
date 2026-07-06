#!/usr/bin/env node

const { PrismaClient } = require("@prisma/client");

const ALLOWED_FIELDS = [
  "summary", "body", "sourceExcerpt", "sourceUrl",
  "sourceDescription", "sourceType", "verificationStatus",
  "domainTag", "archivedAt",
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i++;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cardId = args.id;
  const isApply = !!args.apply;

  if (!cardId) {
    console.error("Usage: node update-card-fields.js --id <card-id> [--summary-env ENV] [--body-env ENV] [--source-excerpt-env ENV] [--apply]");
    process.exit(1);
  }

  const envFields = {
    summary: args["summary-env"],
    body: args["body-env"],
    sourceExcerpt: args["source-excerpt-env"],
  };

  const data = {};
  for (const [field, envName] of Object.entries(envFields)) {
    if (!envName) continue;
    const val = process.env[envName];
    if (val === undefined) {
      console.error(`Environment variable $${envName} is not set`);
      process.exit(1);
    }
    if (!ALLOWED_FIELDS.includes(field)) {
      console.error(`Field "${field}" is not in whitelist`);
      process.exit(1);
    }
    data[field] = val;
  }

  for (const key of Object.keys(args)) {
    if (ALLOWED_FIELDS.includes(key) && !envFields[key]) {
      if (key === "archivedAt") {
        data[key] = args[key] === "now" ? new Date() : new Date(args[key]);
      } else {
        data[key] = args[key];
      }
    }
  }

  if (Object.keys(data).length === 0) {
    console.error("No fields to update. Provide --summary-env, --body-env, etc.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const card = await prisma.knowledgeCard.findUnique({ where: { id: cardId } });

  if (!card) {
    console.error(`Card not found: ${cardId}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`Card: ${card.summary}`);
  console.log(`Fields: ${Object.keys(data).join(", ")}`);
  console.log(`Mode: ${isApply ? "APPLY" : "DRY-RUN (pass --apply to write)"}`);

  for (const [field, value] of Object.entries(data)) {
    const old = card[field] || "";
    const unit = field === "archivedAt" ? "" : ` (${old.length} -> ${String(value).length} chars)`;
    console.log(`  ${field}${unit}`);
  }

  if (!isApply) {
    await prisma.$disconnect();
    return;
  }

  await prisma.knowledgeCard.update({ where: { id: cardId }, data });

  const updated = await prisma.knowledgeCard.findUnique({ where: { id: cardId } });
  console.log("\nVerification:");
  for (const field of Object.keys(data)) {
    const v = updated[field];
    console.log(`  ${field}: OK (${v ? String(v).length : 0} chars)`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
