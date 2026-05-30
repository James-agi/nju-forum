import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { upsertDefaultForumSections } from "./default-sections";

const prisma = new PrismaClient();

async function main() {
  const password = await hash("123456", 12);

  const sections = await upsertDefaultForumSections(prisma);

  const user1 = await prisma.user.upsert({
    where: { email: "test1@nju.edu.cn" },
    update: {},
    create: {
      email: "test1@nju.edu.cn",
      name: "测试用户1",
      password,
      role: "ADMIN",
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: "test2@nju.edu.cn" },
    update: {},
    create: {
      email: "test2@nju.edu.cn",
      name: "测试用户2",
      password,
    },
  });

  const samplePosts = [
    { title: "有没有一起刷 LeetCode 的同学？", content: "最近在准备秋招，想找几个同学一起每天刷题，互相监督。目前进度大概 200 题左右，目标是秋招前刷到 500 题。有意向的同学回复我～", sectionId: sections[0].id, authorId: user1.id },
    { title: "推荐一下数据结构的网课", content: "大二要学数据结构了，有没有好的网课推荐？最好是中文的，英文的也可以接受。", sectionId: sections[0].id, authorId: user2.id },
    { title: "食堂新出的麻辣香锅好吃吗", content: "听说二食堂新出了麻辣香锅，有人吃过吗？味道怎么样？值不值得排队？", sectionId: sections[1].id, authorId: user1.id },
    { title: "出一台 MacBook Pro 2023", content: "因为换了新电脑，出一台 MacBook Pro 2023，M2 Pro 芯片，16GB + 512GB，九成新，配件齐全。价格私聊。", sectionId: sections[2].id, authorId: user2.id },
    { title: "图书馆占座问题能不能管管", content: "每天早上图书馆一堆书放着没人，座位全被占了，真正想学习的同学没位置坐。学校能不能出台个规定？", sectionId: sections[4].id, authorId: user1.id },
    { title: "求推荐南京好玩的地方", content: "周末想出去玩，不想跑太远，南京市内有什么好玩的地方推荐？最好是适合拍照的。", sectionId: sections[1].id, authorId: user2.id },
    { title: "考研资料出一波", content: "出一些考研复习资料，数学一、英语一、政治，还有专业课的真题。打包价优惠。", sectionId: sections[2].id, authorId: user1.id },
    { title: "宿舍网络太差了怎么办", content: "最近宿舍网络特别差，打游戏延迟高到飞起，有没有什么解决办法？", sectionId: sections[3].id, authorId: user2.id },
    { title: "有没有人一起组队参加数学建模", content: "全国大学生数学建模竞赛快开始了，还差一个人，最好是编程比较强的。我们两个一个是数学专业一个是统计专业的。", sectionId: sections[0].id, authorId: user1.id },
    { title: "学校附近的健身房推荐", content: "想办张健身卡，学校附近有没有性价比高的健身房推荐？最好是有游泳池的。", sectionId: sections[1].id, authorId: user2.id },
  ];

  for (const post of samplePosts) {
    await prisma.post.create({ data: post });
  }

  console.log("Seed data created successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
