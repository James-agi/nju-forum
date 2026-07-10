import { PrismaClient, type SourceType, type VerificationStatus } from "@prisma/client";

const db = new PrismaClient();

const SOURCE_URL = "https://www.yuque.com/greatnju/q-a2.0/pqqznl";
const SOURCE_DESC = "南哪助手·新生问答&指南2.0（2025版）·如果遇到问题怎么办";

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
    summary: "提问前先自己找答案（RTFM + STFW）",
    body: "遇到问题第一件事不是问别人，而是先自己查。两个缩写记一下：RTFM（Read The Friendly Manual）和 STFW（Search The Friendly Web）。\n\n查的顺序：①[学生手册](https://jw.nju.edu.cn/5c/84/c24748a416900/page.htm)、新生入学指导材料；②辅导员教务员在群里的通知、群文件、群精华、群公告；③本科生院、学院官网等校职能部门网站；④搜索引擎（搜\"[南京大学新/老/本/研万能指南](https://mp.weixin.qq.com/s/JjwMAshJofVJaqAeixL7og)\"）；⑤学生社团和公益组织（IT侠、南哪助手、表白墙等）；⑥民间水群的群精华，觉得重要的东西单独发给自己存着，或存进[南大云盘](https://box.nju.edu.cn/)。\n\n如果你能自己找到答案，问题就解决了。如果找不到，说明你的问题至少没人解答过，也就说明你的问题或许是有价值的。",
    sourceExcerpt: "遇到问题，第一件事情并不是去寻求别人的帮助，而是 RTFM : Read The Friendly(Fucking) Manual；STFM : Search The Friendly(Fucking) Web。换句话说，在问别人之前，先看看是否已经有人解答了这些问题。通常来说，你可以按照如下的顺序寻找答案：1 [学生手册](https://jw.nju.edu.cn/5c/84/c24748a416900/page.htm)，新生入学指导材料（适用于劳育要求、通识学分要求、体测毕业相关要求等），学习指南；2 辅导员、教务员在群内的通知、公告，聊天记录等；3 本科生院、学院网站、学工处、信息中心等校职能部门的官网；4 搜索引擎（必应、谷歌等，搜索技巧：[南京大学新/老/本/研万能指南](https://mp.weixin.qq.com/s/JjwMAshJofVJaqAeixL7og)）；5 各类学生社团、公益性组织，如IT侠（QQ：2461908536），南哪助手，表白墙（QQ：2074934525），校园集市；6 各种民间水群的群精华，可以把觉得重要的东西单独发给自己账号上的\"我的电脑\"/\"文件传输助手\"，或存进[南大云盘](https://box.nju.edu.cn/)。",
    domainTag: "组织资源",
    sourceType: "DOCUMENT",
    verificationStatus: "NEEDS_REVIEW",
  },
  {
    summary: "找谁问问题——咨询对象的优先级排序",
    body: "问题自己解决不了，下一步是找对的人。优先级从高到低：\n\n第一，直接相关方：任课老师、辅导员、院系教务员，联系方式一般在学院官网能查到。\n\n第二，职能部门：本科生院、学工处、信息中心等，各部门职责分工在官网有。食堂问题扫桌上二维码反馈，其他问题在南京大学APP的\"我要反馈\"模块提。\n\n第三，熟人资源：值得信赖的学长学姐或同级同学。\n\n第四，非官方渠道：IT侠、南哪助手、校园表白墙等公益组织或社群。\n\n一个小提醒：校园集市发帖前先搜一下，不要刷帖。",
    sourceExcerpt: "在明确问题后，下一步是选择合适的咨询对象和沟通方式。以下是推荐的优先级顺序：1 直接相关方：任课老师、辅导员、院系（大类/书院）教务员；2 职能部门：本科生院、学工处、信息中心等机构的工作人员；a 如遇食堂就餐问题可扫描桌上的二维码-后勤服务反馈，其他想要反馈的都可以在南京大学APP里的\"我要反馈\"模块进行反馈；3 熟人资源：值得信赖的学长学姐或同级同学；4 非官方渠道：公益组织账号或社群，如IT侠、南哪助手、校园表白墙等。",
    domainTag: "组织资源",
    sourceType: "DOCUMENT",
    verificationStatus: "NEEDS_REVIEW",
  },
  {
    summary: "联系老师的三种方式——线下、电话、邮件哪个更靠谱",
    body: "找老师解决问题有三种方式，各有优劣，邮件是力荐的。\n\n线下（工作时间上午10:00-12:00，下午14:00-17:00）：最快最有可能找到答案，老师倾向于先解决眼前的事。但缺点是社恐压力大，而且如果老师外出就白跑一趟。\n\n打电话（必须是办公室电话，不是手机）：可以先确认老师是否在办公室，免得白跑。电话不用面对面，社恐友好。但电话不能留下操作凭证——没有凭证就没有后续追究责任的依据，所以涉及需要对方操作的业务问题电话解决不了。注意要在工作时间打。\n\n发邮件（力荐）：可以完整清晰展现你的想法，留下沟通凭证，给老师自由的处理时间。注意用学生邮箱发，收件人也选校园邮箱。\n\n总的来说，不紧急的问题用电话或邮件；紧急的先打电话确认老师有没有空，再线下去找。",
    sourceExcerpt: "对于任课老师、辅导员教务员，以及职能部门的老师，我推荐三种联系方式：1 在工作时间线下去找：这确实是最快也最有可能找到问题答案的方式，很多老师平日里要处理的文件复杂，工作繁忙，你的留言邮件等即使看到了也不一定能马上处理，线下询问是抢占式的，因为人往往都倾向于先解决近在眼前的事情。但线下往往是最考验社恐的，单单的敲门进去或许就在社恐内心上演了一场大戏。更重要的是，如果老师有事外出，就是白跑一趟浪费时间。工作时间一般是工作日的上午10:00-12:00，下午14：00-17：00。2 在工作时间拨打办公室电话：注意是办公室电话，因为手机往往具有私人属性。电话的好处之一是可以确认老师是否在办公室，可以免得白跑一趟。此外，电话不用面对面的交流，对于社恐来说，紧张感没有线下见面那么强。对于一些简单的事务，电话往往是高效的。但如果涉及到一些业务问题需要对方老师操作的话，电话往往是不够的。因为电话并不能留下操作的凭证，而没有凭证就没有后续追究责任的依据。3 使用学生邮箱发邮件：这是我力荐的方式。邮件可以完整清晰的展现出你的真实想法。与微信和QQ不同，邮件是一种非常正式的交流方式，且邮件会留下完整的沟通凭证。注意：请使用你的学生邮箱发送邮件，收件人地址也选择校园邮箱。",
    domainTag: "校园办事",
    sourceType: "DOCUMENT",
    verificationStatus: "NEEDS_REVIEW",
  },
  {
    summary: "校园邮箱有什么用——不只是收发邮件",
    body: "[校园邮箱](https://itsc.nju.edu.cn/1b/ce/c21586a334798/page.htm)不只是个邮箱，它有两个实际好处：\n\n第一，提升邮件可信度。用校园邮箱发的邮件不容易被当成垃圾邮件，老师和机构能顺利收到。校内公务沟通（联系教务处、交作业等）用校园邮箱更正式更规范。\n\n第二，获取[正版软件](https://itsc.nju.edu.cn/zbrj/list.psp)和教育优惠。学校买了不少正版软件，用校园邮箱激活就能免费用。校外的教育优惠也能用校园邮箱申请，详见[学生邮箱权益一览](https://www.yuque.com/keke.sorry/q-a2.0/cer8qyywmv1xpym5)。",
    sourceExcerpt: "[校园邮箱](https://itsc.nju.edu.cn/1b/ce/c21586a334798/page.htm)是学校为每个学生提供的邮箱，它不仅是身份凭证，还能带来不少实用好处：1 提升邮件可信度：相比私人邮箱（如QQ、163等），校园邮箱发送的邮件更不易被误判为垃圾邮件，确保重要信息能被老师或机构顺利接收。校内公务沟通时，使用校园邮箱显得更正式、更规范。2 获取正版软件或教育优惠：学校购买了不少正版软件，你可以用校园邮箱去激活然后免费使用。详见[正版软件介绍](https://itsc.nju.edu.cn/zbrj/list.psp)。助手也整理了不少校外的教育优惠。详见[学生邮箱权益一览](https://www.yuque.com/keke.sorry/q-a2.0/cer8qyywmv1xpym5)。",
    domainTag: "网络系统",
    sourceType: "DOCUMENT",
    verificationStatus: "NEEDS_REVIEW",
  },
  {
    summary: "怎么提问才有效——8个实用技巧",
    body: "提问方式直接决定能不能得到有效回答。8个技巧：\n\n①起一个清晰明确的主题（邮件适用），让人一眼看出你问什么。②问候你的读者，虽然客套但这是礼貌，问完也要加感谢。③建立信誉，清晰表明你是谁、这次提问的价值是什么。④把问题放在显眼位置，最好是开头。很多人习惯从头讲前因后果，对方读了半天才发现要问什么，这很不明智。绝对不要只发\"在吗\"却不同时说问题。⑤如果可以的话给出一些可能的解决方案，让别人更有针对性地处理。⑥组织语言让问题清晰易懂、没有歧义。⑦如果事情紧急，说出期限，老师不知道你需要什么时候解决。⑧不要用过长篇幅，简明扼要。",
    sourceExcerpt: "所有的提问都应礼貌且尊重。下面我列出了几个值得注意的点：1 起一个清晰明确的主题（邮件适用）：往往人在收到邮件（尤其是手机端）时，会先浏览主题，以确认邮件的性质。一个好的主题可以让你的问题更快的得到处理。2 问候你的读者：虽然客套，但这是礼貌；（发完邮件也加上问候感谢）3 建立你的信誉：即清晰的表明你的身份，表达这次提问的价值4 将问题放在显眼的位置：最好是开头。这点很多人都会忽略，因为大家往往会采用时间的顺序去讲述前因后果，但很多时候对方可能读了很久才发现要提的什么问题，这显然是不明智的；此外，非常不推荐使用\"在吗\"却不同时提出问题的方式。（重要！）5 可以的话给出一些可行的解决方案：提出一些可能的解决方案可以让别人更有针对性的处理你的问题6 组织你的语言，让你的问题清晰易懂，没有歧义7 如果事情紧急的话，可以说出这件事情的期限：有些老师并不知道你所说事情需要什么时间解决，表明这一点可以让他们更加从容的安排时间8 不要使用过长的篇幅：大家的时间都有限，请简明扼要的阐述你的问题",
    domainTag: "组织资源",
    sourceType: "DOCUMENT",
    verificationStatus: "NEEDS_REVIEW",
  },
  {
    summary: "提问的进阶经验——精准描述、找准对象、把握时机",
    body: "除了基本技巧，还有几条进阶经验：\n\n精准描述问题：用\"现象描述+影响分析+预期目标\"的结构。比如\"在XX软件操作中，执行XX步骤时出现XX报错信息（附截图，红框标出重点），导致XX功能无法正常使用，期望解决后能实现XX效果\"。\n\n找准求助对象：基于问题属性匹配对应领域的专业人士，别跨校区、跨年级咨询时对方根本不知道你说的是什么。\n\n把握沟通时机：尊重对方作息，避免午休、深夜发起即时需求。可以通过预约或留言确认对方方便的时间。\n\n体现自主性：提问前先通过官方文档、搜索引擎做基础排查，展现解决问题的诚意，比如表明\"查询无果深受困扰\"。\n\n遵循社交礼仪：用\"请问\"等礼貌用语，问题解决后及时致谢，构建良性互动。\n\n这些经验节选自[电子学院课程资料分享计划](https://git.nju.edu.cn/njuEE/awesomeee/-/wikis/Home)（需南大邮箱登录，登录方式参考[【IT服务】南大邮箱系列问答](https://itsc.nju.edu.cn/96/2e/c21475a497198/page.htm#1)）。",
    sourceExcerpt: "PS：一点个人经验：1 在学术交流或日常求助场景中，高效、得体地提问是提升沟通效率的关键。首先，需精准描述问题：建议采用\"现象描述+影响分析+预期目标\"结构，例如\"在XX软件操作中，执行XX步骤时出现XX报错信息（附电脑编辑标注的截图/错误代码，红框框出你想强调的部分），导致XX功能无法正常使用，期望解决后能实现XX效果\"。2 其次，需找准求助对象：应基于问题属性匹配对应领域的专业人士，避免因信息不对称导致无效沟通。3 再次，需把握沟通时机：尊重对方作息规律，避免在非工作时间段（如午休、深夜）发起即时性需求，可通过预约或留言方式确认对方方便的时间窗口。4 此外，需体现自主性：提问前应通过官方文档、搜索引擎等渠道进行基础排查，展现解决问题的诚意。5 最后，需遵循社交礼仪：提问时使用\"请问\"等礼貌用语，问题解决后及时致谢，构建良性互动关系。注：本部分内容节选自[电子学院课程资料分享计划](https://git.nju.edu.cn/njuEE/awesomeee/-/wikis/Home)（需要使用南大邮箱登录。南大邮箱的登录方式，可以参考[【IT服务】南大邮箱系列问答](https://itsc.nju.edu.cn/96/2e/c21475a497198/page.htm#1)）。",
    domainTag: "组织资源",
    sourceType: "DOCUMENT",
    verificationStatus: "NEEDS_REVIEW",
  },
];

async function main() {
  const author = await db.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });

  if (!author) {
    throw new Error("找不到 ADMIN 用户，请先运行 npm run db:seed 创建管理员账号");
  }

  let created = 0;
  let skipped = 0;

  for (const card of CARDS) {
    const existing = await db.knowledgeCard.findFirst({
      where: { summary: card.summary, archivedAt: null },
      select: { id: true },
    });

    if (existing) {
      console.log(`跳过（已存在）：${card.summary}`);
      skipped += 1;
      continue;
    }

    await db.knowledgeCard.create({
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
    console.log(`创建：${card.summary}`);
    created += 1;
  }

  console.log(`\n知识卡片 seed 完成：新建 ${created} 张，跳过（已存在）${skipped} 张。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
