import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const keywords = [
    "校园信息卡",
    "宽带信息卡",
    "电话卡",
    "办卡",
    "手机卡",
    "运营商",
    "移动",
    "联通",
    "电信",
    "校园卡",
    "宽带",
    "电话",
    "上网",
    "网络",
    "WiFi",
  ];

  const where = {
    archivedAt: null,
    OR: keywords.flatMap((kw) => [
      { summary: { contains: kw } },
      { body: { contains: kw } },
    ]),
  };

  const cards = await prisma.knowledgeCard.findMany({
    where,
    select: {
      id: true,
      summary: true,
      body: true,
      domainTag: true,
      verificationStatus: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`找到 ${cards.length} 张匹配的卡片：\n`);
  cards.forEach((card, i) => {
    console.log(`--- 卡片 ${i + 1} ---`);
    console.log(`ID: ${card.id}`);
    console.log(`摘要: ${card.summary}`);
    console.log(`领域标签: ${card.domainTag}`);
    console.log(`验证状态: ${card.verificationStatus}`);
    console.log(`正文前200字: ${card.body.substring(0, 200)}...`);
    console.log("");
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