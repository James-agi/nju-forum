import { PrismaClient, type SourceType, type VerificationStatus } from "@prisma/client";

const prisma = new PrismaClient();

const SOURCE_URL = "https://www.yuque.com/greatnju/q-a2.0/bytnsd1a5wgii8lb";
const SOURCE_DESC = "南哪助手·新生问答&指南2.0（2025版）·02 课程类型之通识课";

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
    summary: "通识课总学分要求与推荐组成方案（2025级）",
    body: "2025级通识课要凑满11学分，分5类，每类都有最低线。建议大一就照推荐方案配齐，别拖到高年级跟专业课抢时间。\n\n五类与最低要求：课程号以002/003/004/005/006/37/500开头的都算通识课，分为人工智能通识核心课（≥1分）、人文与社会科学（悦读≥1分，加其余至少2分）、自然科学与技术（科学之光≥1分，加其余至少2分）、美育（≥2分）、劳动教育（理论1分加实践1分）。\n\n最省心的11分配法：1分人工智能通识，加1分悦读，加1分科学之光，加2分美育，加1分劳动教育理论，加1分劳动教育实践，加2分普通人文类通识，加2分普通自然类通识。\n\n几个容易踩的点：美育、科学之光这类原则上大一修完且只能修一次的课优先抢；劳动教育理论会自动进课表别漏；普通通识里002开头的新生研讨课只有大一能选，是稀缺机会。（信息适用于2025级方案，后续年级要求可能调整，选课前以本科生院最新通知为准）",
    sourceExcerpt: "通识课总学分需要达到11学分！！\n类型与最低要求学分：人工智能通识核心课 1；人文与社会科学 悦读课1学分加其余至少2学分；自然科学与技术 科学之光1学分加其余至少2学分；美育 2；劳动教育 理论1学分加实践1学分。\n最普遍且合适的11学分组成方案为：1学分人工智能通识加1学分悦读课程加1学分科学之光加2学分美育加1学分劳动教育理论加1学分劳动教育实践加2学分普通人文类通识加2学分普通自然类通识。",
    domainTag: "课程学业",
    sourceType: "DOCUMENT",
    verificationStatus: "UNVERIFIED",
  },
  {
    summary: "劳动教育理论课程怎么修（2025级新生）",
    body: "劳动教育理论1学分，大一第一学期会自动塞进你的课表，本质是刷网课。别因为不是自己主动选的，就忘了它存在。\n\n开学后要主动做的事：课程分3个班，必须加对应的课程QQ群（在哪个班看课表），考试别忘记，忘考会挂。\n\n万一挂了也别慌，春季学期可以继续重修，不是一锤子买卖。（信息适用于2025级方案）",
    sourceExcerpt: "劳动教育理论课程：1个学分的理论课程，每学期都开，此课程在大一第一学期将会自动置入你的课表，需要加入课程的QQ群（分3个班，具体自己在哪个班可在课表查看），应当在大一第一学期就完成，主要内容就是刷网课。如果因为忘记考试等原因导致挂科，可以在春季学期继续重修。",
    domainTag: "课程学业",
    sourceType: "DOCUMENT",
    verificationStatus: "UNVERIFIED",
  },
  {
    summary: "劳动教育实践课程怎么修（2025级新生）",
    body: "劳动教育实践1学分，不在选课系统里上课，而是要去五育平台(ndwy.nju.edu.cn)报名并完成线下活动、攒够时长。建议大一就开始攒别拖。\n\n两个容易栽的地方：一是志愿服务想算时长，必须是团委负责的项目，别的不认；二是学分不用自己交，做完后院系教务员会过段时间录入，成绩显示通过，不计入学分绩。\n\n待核实：实践时长的具体构成（基础、学科、综合实践模块各需几小时，勤工助学与志愿服务各自上限）原文档是用一张导引图给的，本卡抓取时图被识别成乱码，暂未收录，需对照原图补全。（信息适用于2025级方案）",
    sourceExcerpt: "劳动教育实践课程：1个学分，即需要在南京大学五育平台（ndwy.nju.edu.cn)上报名并完成相关的活动才可以拿到学分。基础实践模块不一定必须要在大一做完，但最好建议在大一做完。学科实践也可以提前在大一完成（可以参加自己学院的学科实践，也可以参加别的学院的）。这里的志愿服务请注意必须是团委负责的才能记录劳动时长。当你完成了图中的实践课程要求后，本院系教务员将会在一段时间后录入你这一门实践课程的1个学分，成绩显示为通过，不算入学分绩。\n（注：原文档含一张劳动教育学习导引图，列出各实践模块的具体学时，本次抓取OCR乱码未收录。）",
    domainTag: "课程学业",
    sourceType: "DOCUMENT",
    verificationStatus: "NEEDS_REVIEW",
  },
  {
    summary: "美育课程要求（2025级新生）",
    body: "美育课2学分，一般以某某人文命名，原则上大一修完、只需修一次，是凑通识学分里比较省事的一块。\n\n顺带提一句：美育和科学之光这两类课，如果第一学期没选上不用慌，大一下学期还能补，但强烈建议别拖到大二，拖到大二会和专业课挤在一起。（信息适用于2025级方案）",
    sourceExcerpt: "美育课程：一般以某某人文命名的课程，2个学分，原则上必须要在大一修读完成，只需要修读一次即可。\n（同篇下文：如果美育课程和科学之光课程在第一学期没选上也不必太过担心，也可以在大一下学期上，但强烈建议不要拖到大二。）",
    domainTag: "课程学业",
    sourceType: "DOCUMENT",
    verificationStatus: "UNVERIFIED",
  },
  {
    summary: "科学之光课程怎么修（大科光与青年科光，2025级）",
    body: "科学之光1学分，分大科光和青年科光两种形态，原则上大一修完、只能修一次、不可重复修，按自己喜好二选一即可。\n\n两者区别和报名方式：大科光是一两百人的大班讲座课，直接在选课平台自己选；青年科光是几人到十几人的讨论班，不在选课平台，需自己向老师报名，具体等书院通知。\n\n和美育一样，第一学期没选上可在大一下学期补，但别拖到大二。（信息适用于2025级方案）",
    sourceExcerpt: "科学之光课程：1个学分的课程，分为大科光和青年科光，二者的区别是，大科光是一两百个人的大班上课，类似于讲座形式的课程；而青年科光是几个人、十几个人的讨论班形式。其中大科光可以在选课平台上自己选择，而青年科光需要自己向老师报名（具体情况需要等书院通知）。原则上科学之光课程也需要在大一修读完毕，且只允许修读一次，不可以重复修读。",
    domainTag: "课程学业",
    sourceType: "DOCUMENT",
    verificationStatus: "UNVERIFIED",
  },
  {
    summary: "悦读课程怎么修（经典导读与DIY研读课，2025级）",
    body: "悦读课有两条路：线上经典导读慢慢攒，或线下DIY研读课一门到位，按你愿不愿意线下上课来选。\n\n经典导读（线上为主）：选课平台自选，全程网上自主进行加若干次线下交流课，分六个模块（文学与艺术、哲学与宗教、经济与社会、自然与生命、全球化与领导力、历史与文明）。修完3个不同模块得1学分，6个模块全修完得2学分，成绩取所修课程平均值。\n\nDIY研读课（线下）：线下上课、很可能在仙林校区，上完一门直接得2个悦读学分，报名按本科生院选课通知里的方式。据上过的同学说收获较大，但前提是你真的喜欢阅读。\n\n一个小提醒：系统里悦读课全标仙林校区，但实际任何校区都能上，别被校区标注吓退。（信息适用于2025级方案）",
    sourceExcerpt: "悦读课程：分为经典导读读书班和DIY研读课。悦读课在系统上全部标注为仙林校区，但其实任何校区都可以上。（1）经典导读：在选课平台上自己可以选择，分为六个单元模块。当修读完三个不同模块的课程之后，可以获得1个悦读学分；如果把所有的六个不同模块全都修读过，可以获得2个悦读学分。（2）DIY研讨课：需要进行线下上课（而且很大可能是在仙林校区），上完一门课可以直接获得2个用于悦读课程的学分。据上过的同学说：收获比较大（但也需要你喜欢阅读）。",
    domainTag: "课程学业",
    sourceType: "DOCUMENT",
    verificationStatus: "UNVERIFIED",
  },
  {
    summary: "人工智能通识课程要求（2025级新生）",
    body: "人工智能通识课要求至少拿1学分，这是南大近年新增的通识硬性要求，别漏掉。\n\n待核实：原文档只明确写了2024级为拼盘讲座、共计1学分，没有写出2025级的具体上课形式。因此2025级到底以什么形式开课、是否仍是拼盘讲座，需等本科生院或书院通知确认后再补全本卡。（适用范围待核实，请以官方通知为准）",
    sourceExcerpt: "人工智能通识课程：需要至少获得一个学分。2024级为拼盘讲座，共计1个学分。",
    domainTag: "课程学业",
    sourceType: "DOCUMENT",
    verificationStatus: "NEEDS_REVIEW",
  },
  {
    summary: "普通通识课与新生研讨课（002开头，2025级）",
    body: "除去上面那些特殊通识课，剩下的就是普通通识课，在选课平台的导学、研讨、通识板块里选。其中002开头的新生研讨课是大一限定，务必把握。\n\n为什么优先抢002：通识课普遍很难抢，而002开头的新生研讨课只有大一同学能选，过了大一就没机会，属于稀缺资源。另有少部分通识课只对高年级开放。\n\n一个小提醒：通识课里一些标注自由时间、自由地点的课通常是线上进行，因此可以跨校区修读，不受你所在校区限制。（信息适用于2025级方案）",
    sourceExcerpt: "普通通识课：就是除了以上特殊通识课的通识课程，也就是选课平台的导学、研讨、通识板块。其中002开头的是新生研讨课，只有大一的同学可以选（通识课一般很难抢，大一的同学可以把握住新生研讨课的机会哦）。当然也有少部分的通识课只给高年级同学上。通识课中有一些自由时间、自由地点的课一般是线上进行，所以也可跨校区修读。",
    domainTag: "课程学业",
    sourceType: "DOCUMENT",
    verificationStatus: "UNVERIFIED",
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
