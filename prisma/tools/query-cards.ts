import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function queryCards(options: {
  keyword?: string;
  domainTag?: string;
  status?: string;
  limit?: number;
}) {
  const { keyword, domainTag, status, limit = 50 } = options;

  const where: any = { archivedAt: null };

  if (keyword) {
    where.OR = [
      { summary: { contains: keyword, mode: "insensitive" } },
      { body: { contains: keyword, mode: "insensitive" } },
    ];
  }

  if (domainTag) {
    where.domainTag = domainTag;
  }

  if (status) {
    where.verificationStatus = status;
  }

  const cards = await prisma.knowledgeCard.findMany({
    where,
    select: {
      id: true,
      summary: true,
      domainTag: true,
      verificationStatus: true,
      sourceType: true,
      sourceDescription: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  console.log(`\n查询到 ${cards.length} 张卡片：\n`);
  console.log("=".repeat(80));

  for (const c of cards) {
    const status = c.verificationStatus === "VERIFIED" ? "✓" : "○";
    console.log(`[${status}] ${c.domainTag} | ${c.summary}`);
    console.log(`    来源: ${c.sourceDescription} | 类型: ${c.sourceType}`);
    console.log(`    ID: ${c.id}`);
    console.log("-".repeat(80));
  }

  return cards;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "all";

  switch (command) {
    case "search": {
      const keyword = args[1];
      if (!keyword) {
        console.log("用法: tsx query-cards.ts search <关键词>");
        return;
      }
      await queryCards({ keyword });
      break;
    }
    case "tag": {
      const tag = args[1];
      if (!tag) {
        console.log("用法: tsx query-cards.ts tag <domainTag>");
        return;
      }
      await queryCards({ domainTag: tag });
      break;
    }
    case "status": {
      const status = args[1];
      if (!status) {
        console.log("用法: tsx query-cards.ts status <VERIFIED|NEEDS_REVIEW|UNVERIFIED>");
        return;
      }
      await queryCards({ status });
      break;
    }
    case "all":
    default:
      await queryCards({});
      break;
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());