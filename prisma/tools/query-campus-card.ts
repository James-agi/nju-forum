import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 查询与校园卡相关的卡片
  const cards = await prisma.knowledgeCard.findMany({
    where: {
      OR: [
        { summary: { contains: "校园卡" } },
        { body: { contains: "校园卡" } },
        { sourceDescription: { contains: "校园卡" } },
        { domainTag: { contains: "校园卡" } },
      ],
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

  console.log(`找到 ${cards.length} 张与校园卡相关的卡片：`);
  cards.forEach((card, i) => {
    console.log(`\n--- 卡片 ${i + 1} ---`);
    console.log(`ID: ${card.id}`);
    console.log(`摘要: ${card.summary}`);
    console.log(`来源URL: ${card.sourceUrl}`);
    console.log(`来源描述: ${card.sourceDescription}`);
    console.log(`领域标签: ${card.domainTag}`);
    console.log(`正文前200字: ${card.body.substring(0, 200)}...`);
  });
  
  // 也查询与支付相关的卡片
  const payCards = await prisma.knowledgeCard.findMany({
    where: {
      OR: [
        { summary: { contains: "支付" } },
        { body: { contains: "支付" } },
        { summary: { contains: "充值" } },
        { body: { contains: "充值" } },
        { summary: { contains: "缴费" } },
        { body: { contains: "缴费" } },
      ],
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

  console.log(`\n找到 ${payCards.length} 张与支付/充值/缴费相关的卡片：`);
  payCards.forEach((card, i) => {
    console.log(`\n--- 支付卡片 ${i + 1} ---`);
    console.log(`ID: ${card.id}`);
    console.log(`摘要: ${card.summary}`);
    console.log(`来源URL: ${card.sourceUrl}`);
    console.log(`来源描述: ${card.sourceDescription}`);
    console.log(`领域标签: ${card.domainTag}`);
    console.log(`正文前200字: ${card.body.substring(0, 200)}...`);
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