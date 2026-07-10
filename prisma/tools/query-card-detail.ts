import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 查询卡片5的完整内容
  const card = await prisma.knowledgeCard.findUnique({
    where: { id: "cmq0um096000br62cj7j4jr21" },
    select: {
      id: true,
      summary: true,
      body: true,
      sourceUrl: true,
      sourceDescription: true,
      domainTag: true,
    },
  });

  if (card) {
    console.log("卡片完整内容：");
    console.log(`ID: ${card.id}`);
    console.log(`摘要: ${card.summary}`);
    console.log(`来源URL: ${card.sourceUrl}`);
    console.log(`来源描述: ${card.sourceDescription}`);
    console.log(`领域标签: ${card.domainTag}`);
    console.log(`\n正文：\n${card.body}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });