import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 查询来源URL为 hhnbon 的卡片
  const cards = await prisma.knowledgeCard.findMany({
    where: {
      sourceUrl: { contains: "hhnbon" },
      archivedAt: null,
    },
    select: {
      id: true,
      summary: true,
      body: true,
      sourceUrl: true,
      sourceDescription: true,
      domainTag: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`找到 ${cards.length} 张来源URL包含 hhnbon 的卡片：`);
  cards.forEach((card, i) => {
    console.log(`\n--- 卡片 ${i + 1} ---`);
    console.log(`ID: ${card.id}`);
    console.log(`摘要: ${card.summary}`);
    console.log(`来源URL: ${card.sourceUrl}`);
    console.log(`来源描述: ${card.sourceDescription}`);
    console.log(`领域标签: ${card.domainTag}`);
    console.log(`正文前200字: ${card.body.substring(0, 200)}...`);
  });
  
  // 也查询来源描述包含"信息化指南"的卡片
  const infoCards = await prisma.knowledgeCard.findMany({
    where: {
      sourceDescription: { contains: "信息化指南" },
      archivedAt: null,
    },
    select: {
      id: true,
      summary: true,
      body: true,
      sourceUrl: true,
      sourceDescription: true,
      domainTag: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`\n找到 ${infoCards.length} 张来源描述包含"信息化指南"的卡片：`);
  infoCards.forEach((card, i) => {
    console.log(`\n--- 信息化卡片 ${i + 1} ---`);
    console.log(`ID: ${card.id}`);
    console.log(`摘要: ${card.summary}`);
    console.log(`来源URL: ${card.sourceUrl}`);
    console.log(`来源描述: ${card.sourceDescription}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });