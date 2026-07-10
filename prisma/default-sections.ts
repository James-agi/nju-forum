import type { PrismaClient } from "@prisma/client";

export const DEFAULT_FORUM_SECTIONS = [
  {
    name: "学习",
    description: "课程、考试、作业、学习方法",
    icon: "📚",
    order: 1,
  },
  {
    name: "生活",
    description: "宿舍、食堂、二手、校园日常",
    icon: "🏫",
    order: 2,
  },
  {
    name: "办事",
    description: "校园卡、证明、报修、医保、系统流程",
    icon: "🧾",
    order: 3,
  },
  {
    name: "发展",
    description: "保研、转专业、升学、就业、竞赛科研",
    icon: "🚀",
    order: 4,
  },
  {
    name: "资源",
    description: "资料、工具、社群、经验合集",
    icon: "🗂️",
    order: 5,
  },
  {
    name: "热点",
    description: "近期讨论、校园新鲜事、临时话题",
    icon: "🔥",
    order: 6,
  },
  {
    name: "其他",
    description: "放不进以上分类的内容",
    icon: "💬",
    order: 7,
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
