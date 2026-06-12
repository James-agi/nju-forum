import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 查询所有卡片，看看有没有与"信息化指南"相关的
  const cards = await prisma.knowledgeCard.findMany({
    where: {
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

  console.log(`总共有 ${cards.length} 张卡片：`);
  
  // 查找可能相关的卡片
  const relatedCards = cards.filter(card => 
    card.summary.includes("信息化") ||
    card.body.includes("信息化") ||
    card.sourceUrl?.includes("yuque.com/greatnju/q-a2.0/hhnbon") ||
    card.sourceDescription.includes("信息化指南") ||
    card.domainTag.includes("信息化") ||
    card.summary.includes("新生") ||
    card.body.includes("新生") ||
    card.sourceDescription.includes("新生")
  );
  
  console.log(`\n找到 ${relatedCards.length} 张可能相关的卡片：`);
  relatedCards.forEach((card, i) => {
    console.log(`\n--- 相关卡片 ${i + 1} ---`);
    console.log(`ID: ${card.id}`);
    console.log(`摘要: ${card.summary}`);
    console.log(`来源URL: ${card.sourceUrl}`);
    console.log(`来源描述: ${card.sourceDescription}`);
    console.log(`领域标签: ${card.domainTag}`);
  });
  
  // 查找来源为"新生问答&指南2.0"的卡片
  const guideCards = cards.filter(card => 
    card.sourceDescription.includes("新生问答&指南2.0") ||
    card.sourceUrl?.includes("yuque.com/greatnju/q-a2.0/")
  );
  
  console.log(`\n找到 ${guideCards.length} 张来自"新生问答&指南2.0"的卡片：`);
  guideCards.forEach((card, i) => {
    console.log(`\n--- 指南卡片 ${i + 1} ---`);
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