import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) {
    console.log("用法: tsx get-cards.ts <id1> [id2] ...");
    return;
  }
  const cards = await prisma.knowledgeCard.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      summary: true,
      body: true,
      sourceDescription: true,
      sourceType: true,
      domainTag: true,
      verificationStatus: true,
    },
  });
  for (const c of cards) {
    console.log("=".repeat(80));
    console.log(`[${c.verificationStatus}] ${c.domainTag} | ${c.summary}`);
    console.log(`来源: ${c.sourceDescription} | 类型: ${c.sourceType}`);
    console.log(`ID: ${c.id}`);
    console.log("-".repeat(80));
    console.log(c.body);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
