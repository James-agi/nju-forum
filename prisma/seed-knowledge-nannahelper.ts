import { PrismaClient, type SourceType, type VerificationStatus } from "@prisma/client";

const prisma = new PrismaClient();

const SOURCE_URL = "https://www.yuque.com/greatnju/q-a2.0/gw3phd";
const SOURCE_DESC = "南哪助手·新生问答&指南2.0（2025版）·南哪助手长期接受同学们投稿";

interface SeedCard {
  summary: string;
  body: string;
  sourceExcerpt: string;
  domainTag: string;
  sourceType: SourceType;
  verificationStatus: VerificationStatus;
}

const CARDS: SeedCard[] = [
  {
    summary: "南哪助手是什么组织（性质与定位）",
    body: `南哪助手是南京大学若干学生自发组成的非营利性民间兴趣小组。它不是官方组织，而是学生自发创建的平台。

几个关键特点：
- 非营利性：不以盈利为目的，纯粹出于热爱和帮助同学的初衷
- 民间性质：不是学校官方组织，而是学生自发创建
- 学术导向：最初以讨论学术为主，后来扩展到帮助新生适应大学生活
- 平台规模：自称是「南哪最大的民间平台」，有一定的影响力

南哪助手主要做的事情包括：
- 运营微信公众号，发布各类指南和经验分享
- 维护新生咨询群，帮助新生解答问题
- 接受同学投稿，分享各类校园经验和信息
- 招募志同道合的同学加入团队

对于新生来说，南哪助手是一个获取校园信息、了解学校生活的重要渠道。它的内容通常比较接地气，更贴近学生实际需求。`,
    sourceExcerpt: "南哪助手是南那若干学生自发组成的非营利性民间兴趣小组。",
    domainTag: "组织资源",
    sourceType: "SENIOR",
    verificationStatus: "NEEDS_REVIEW",
  },
  {
    summary: "如何向南哪助手投稿",
    body: `如果你写了一篇对南哪同学有帮助的文章，可以通过以下方式联系南哪助手投稿：

投稿方式：
- QQ：492711989（小破手）
- 邮箱：nannahelper@163.com

投稿要求：
- 文章要对南哪同学有帮助
- 内容要真实可靠
- 没有明确的格式要求，但建议条理清晰

一个小提醒：南哪助手是学生自发组织，不是官方机构，所以投稿后可能需要一些时间才会回复。别因为没收到即时回复就放弃，他们可能只是在忙。`,
    sourceExcerpt: "如果你认为你的文章对南那er有帮助，欢迎联系南那助手QQ492711989或邮箱nannahelper@163.com投稿。",
    domainTag: "组织资源",
    sourceType: "SENIOR",
    verificationStatus: "NEEDS_REVIEW",
  },
  {
    summary: "如何加入南哪助手团队",
    body: `如果你想加入南哪助手，和一群志同道合的同学一起做事，可以通过以下方式：

招新方式：
南哪助手采取「Boss直聘」模式，没有复杂的流程，直接私聊即可。

联系方式：
- 小破手QQ：492711989
- 小帮手QQ：3238099036
- 邮箱：nannahelper@163.com（可投递简历）

加入前提：
南哪助手强调「为纯粹的热爱所驱动」，他们希望找到真正有热情、愿意做事的同学，而不是为了简历好看。

一个过来人的建议：如果你对南哪助手感兴趣，可以先关注他们的公众号，了解他们平时做什么，看看是否真的符合你的兴趣。别冲动加入后发现和想象的不一样。`,
    sourceExcerpt: "助手团队招新采取「Boss直聘」模式，大家直接私聊小破手QQ（492711989）或小帮手QQ（3238099036）即可！也欢迎大家向助手邮箱（nannahelper@163.com）投递简历！",
    domainTag: "组织资源",
    sourceType: "SENIOR",
    verificationStatus: "NEEDS_REVIEW",
  },
];

async function main() {
  const author = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });

  if (!author) {
    throw new Error("找不到 ADMIN 用户，请先运行 npm run db:seed 创建管理员账号");
  }

  let created = 0;
  let skipped = 0;

  for (const card of CARDS) {
    const existing = await prisma.knowledgeCard.findFirst({
      where: { summary: card.summary, archivedAt: null },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.knowledgeCard.create({
      data: {
        summary: card.summary,
        body: card.body,
        sourceExcerpt: card.sourceExcerpt,
        sourceUrl: SOURCE_URL,
        sourceDescription: SOURCE_DESC,
        sourceType: card.sourceType,
        verificationStatus: card.verificationStatus,
        domainTag: card.domainTag,
        createdById: author.id,
      },
    });
    created += 1;
  }

  console.log(`知识卡片 seed 完成：新建 ${created} 张，跳过（已存在）${skipped} 张。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
