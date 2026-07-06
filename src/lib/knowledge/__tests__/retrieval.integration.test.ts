import { describe, it, expect, beforeAll, afterAll } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

const TEST_USER_ID = "test-integration-user";

describe.runIf(hasDb)("retrieveHybrid (integration)", () => {
  let cardIds: string[] = [];
  let db: Awaited<typeof import("@/lib/db")["db"]>;

  beforeAll(async () => {
    const mod = await import("@/lib/db");
    db = mod.db;

    // 确保测试用户存在（满足 FK）
    await db.user.upsert({
      where: { id: TEST_USER_ID },
      create: { id: TEST_USER_ID, email: "test-integration@nju-forum.dev", name: "Test Integration", password: "n/a" },
      update: {},
    });

    // seed 已知内容的卡片，确保检索能命中
    const cards = await Promise.all([
      db.knowledgeCard.create({
        data: {
          summary: "南大转专业流程和条件",
          body: "转专业需要大一下学期提交申请，绩点要求前30%，需通过转入院系面试",
          sourceDescription: "教务处通知",
          sourceType: "OFFICIAL",
          verificationStatus: "VERIFIED",
          domainTag: "学籍",
          createdById: TEST_USER_ID,
        },
      }),
      db.knowledgeCard.create({
        data: {
          summary: "学分绩计算方法",
          body: "学分绩（GPA）是百分制分数除以20得到绩点，再按学分加权平均",
          sourceDescription: "教务规定",
          sourceType: "OFFICIAL",
          verificationStatus: "VERIFIED",
          domainTag: "选课规则",
          createdById: TEST_USER_ID,
        },
      }),
      db.knowledgeCard.create({
        data: {
          summary: "南大VPN使用指南",
          body: "通过 https://vpn.nju.edu.cn 下载客户端，使用统一身份认证登录",
          sourceDescription: "信息化中心",
          sourceType: "OFFICIAL",
          verificationStatus: "VERIFIED",
          domainTag: "校园服务",
          createdById: TEST_USER_ID,
        },
      }),
      db.knowledgeCard.create({
        data: {
          summary: "三三制培养方案说明",
          body: "三三制是南京大学本科人才培养方案，将本科教育分为三个阶段",
          sourceDescription: "教务文件",
          sourceType: "DOCUMENT",
          verificationStatus: "VERIFIED",
          domainTag: "三三制",
          createdById: TEST_USER_ID,
        },
      }),
      db.knowledgeCard.create({
        data: {
          summary: "宿舍分配规则",
          body: "新生宿舍由学校统一分配，一般按照院系和专业集中安排",
          sourceDescription: "后勤保障",
          sourceType: "DOCUMENT",
          verificationStatus: "VERIFIED",
          domainTag: "校园服务",
          createdById: TEST_USER_ID,
        },
      }),
    ]);
    cardIds = cards.map((c) => c.id);
  });

  afterAll(async () => {
    if (db && cardIds.length > 0) {
      await db.knowledgeCard.deleteMany({ where: { id: { in: cardIds } } });
      await db.user.delete({ where: { id: TEST_USER_ID } }).catch(() => {});
    }
  });

  it("returns keyword-matched cards for explicit question", async () => {
    const { retrieveKnowledgeCards } = await import("../retrieval");
    const results = await retrieveKnowledgeCards("转专业需要什么条件", 5);
    expect(results.length).toBeGreaterThan(0);
    const summaries = results.map((r) => r.card.summary);
    expect(summaries.some((s) => s.includes("转专业"))).toBe(true);
  });

  it("returns empty for unrelated question", async () => {
    const { retrieveKnowledgeCards } = await import("../retrieval");
    const results = await retrieveKnowledgeCards("今天天气怎么样", 5);
    expect(results).toHaveLength(0);
  });

  it("retrieveHybrid returns results and falls back to keyword when no vectors", async () => {
    const { retrieveHybrid } = await import("../retrieval");
    const results = await retrieveHybrid("转专业怎么申请", 5);
    expect(results.length).toBeGreaterThan(0);
    const summaries = results.map((r) => r.card.summary);
    expect(summaries.some((s) => s.includes("转专业"))).toBe(true);
  });

  it("retrieveHybrid with extra terms boosts relevant results", async () => {
    const { retrieveHybrid } = await import("../retrieval");
    const results = await retrieveHybrid("GPA怎么算", 5, ["学分绩"]);
    expect(results.length).toBeGreaterThan(0);
    const summaries = results.map((r) => r.card.summary);
    expect(summaries.some((s) => s.includes("学分绩") || s.includes("GPA"))).toBe(true);
  });
});
