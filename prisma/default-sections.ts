import type { PrismaClient } from "@prisma/client";

export const DEFAULT_FORUM_SECTIONS = [
  {
    name: "学习",
    description: "学习交流、课程讨论、考试经验",
    icon: "📚",
    order: 1,
  },
  {
    name: "生活",
    description: "校园生活、美食推荐、日常分享",
    icon: "🏫",
    order: 2,
  },
  {
    name: "二手",
    description: "闲置物品交易、求购信息",
    icon: "🛒",
    order: 3,
  },
  {
    name: "求助",
    description: "问题求助、经验咨询",
    icon: "🆘",
    order: 4,
  },
  {
    name: "吐槽",
    description: "校园吐槽、自由讨论",
    icon: "💬",
    order: 5,
  },
] as const;

export async function upsertDefaultForumSections(prisma: PrismaClient) {
  return Promise.all(
    DEFAULT_FORUM_SECTIONS.map((section) =>
      prisma.section.upsert({
        where: { name: section.name },
        update: {
          description: section.description,
          icon: section.icon,
          order: section.order,
        },
        create: section,
      })
    )
  );
}
