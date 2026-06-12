import { db } from "../../src/lib/db";

async function main() {
  // Check for job003-related cards
  for (const kw of ["五育", "敦行", "课堂融通", "学业预警", "开除学籍", "退学"]) {
    const cards = await db.knowledgeCard.findMany({
      where: { archivedAt: null, summary: { contains: kw } },
      select: { id: true, summary: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    if (cards.length > 0) {
      console.log(`\n=== "${kw}" (${cards.length} cards) ===`);
      cards.forEach((c) =>
        console.log(`  ${c.createdAt.toISOString().substring(0, 19)} | ${c.summary.substring(0, 80)}`)
      );
    }
  }

  // Count total active cards
  const total = await db.knowledgeCard.count({ where: { archivedAt: null } });
  console.log(`\nTotal active cards: ${total}`);

  process.exit(0);
}

main();
