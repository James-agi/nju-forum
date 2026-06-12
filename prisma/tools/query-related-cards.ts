import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 查询所有与"挂失"、"补办"、"充值"、"缴费"相关的卡片
  const cards = await prisma.knowledgeCard.findMany({
    where: {
      OR: [
        { summary: { contains: "挂失" } },
        { body: { contains: "挂失" } },
        { summary: { contains: "补办" } },
        { body: { contains: "补办" } },
        { summary: { contains: "充值" } },
        { body: { contains: "充值" } },
        { summary: { contains: "缴费" } },
        { body: { contains: "缴费" } },
        { summary: { contains: "电费" } },
        { body: { contains: "电费" } },
        { summary: { contains: "网费" } },
        { body: { contains: "网费" } },
        { summary: { contains: "水费" } },
        { body: { contains: "水费" } },
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

  console.log(`找到 ${cards.length} 张相关卡片：`);
  cards.forEach((card, i) => {
    console.log(`\n--- 卡片 ${i + 1} ---`);
    console.log(`ID: ${card.id}`);
    console.log(`摘要: ${card.summary}`);
    console.log(`来源URL: ${card.sourceUrl}`);
    console.log(`来源描述: ${card.sourceDescription}`);
    console.log(`领域标签: ${card.domainTag}`);
    console.log(`正文前300字: ${card.body.substring(0, 300)}...`);
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