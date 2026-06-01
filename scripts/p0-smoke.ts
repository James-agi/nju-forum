import { DEFAULT_FORUM_SECTIONS } from "../prisma/default-sections";
import { db } from "../src/lib/db";
import {
  evaluateEvidence,
  scoreCard,
  type RetrievalCard,
} from "../src/lib/knowledge/retrieval";
import { classifyP0Scope } from "../src/lib/knowledge/scope";

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";

function assertSmoke(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function checkPage(path: string) {
  const response = await fetch(`${BASE_URL}${path}`, { method: "GET" });
  assertSmoke(response.ok, `${path} returned HTTP ${response.status}`);
}

async function main() {
  const sections = await db.section.findMany({
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });
  const sectionNames = new Set(sections.map((section) => section.name));

  for (const section of DEFAULT_FORUM_SECTIONS) {
    assertSmoke(sectionNames.has(section.name), `missing default section: ${section.name}`);
  }

  const sectionsResponse = await fetch(`${BASE_URL}/api/sections`);
  assertSmoke(sectionsResponse.ok, `/api/sections returned HTTP ${sectionsResponse.status}`);
  const sectionsPayload = (await sectionsResponse.json()) as unknown[];
  assertSmoke(
    Array.isArray(sectionsPayload) && sectionsPayload.length >= DEFAULT_FORUM_SECTIONS.length,
    "/api/sections did not return the default sections"
  );

  await checkPage("/forum");
  await checkPage("/forum/new");
  assertSmoke(sections[0], "no section is available for section page smoke check");
  await checkPage(`/forum/section/${sections[0].id}`);

  const strongCard: RetrievalCard = {
    id: "strong-card",
    summary: "三三制修读规则",
    body: "三三制课程需要按模块完成修读要求。",
    sourceExcerpt: null,
    sourceUrl: null,
    sourceDescription: "官方说明",
    sourceType: "OFFICIAL",
    verificationStatus: "VERIFIED",
    domainTag: "三三制",
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
  };
  const strongResult = {
    card: strongCard,
    ...scoreCard(strongCard, ["三三制", "修读"]),
  };
  assertSmoke(evaluateEvidence([strongResult]).sufficient, "strong evidence was rejected");

  const weakCard: RetrievalCard = {
    ...strongCard,
    id: "weak-card",
    summary: "宿舍网络报修",
    body: "宿舍网络问题可以联系校园服务。",
    domainTag: "校园服务",
  };
  const weakResult = {
    card: weakCard,
    ...scoreCard(weakCard, ["宿舍床尺寸", "宿舍"]),
  };
  assertSmoke(!evaluateEvidence([weakResult]).sufficient, "weak evidence was accepted");

  const scope = classifyP0Scope("帮我发帖问一下新生群");
  assertSmoke(!scope.inScope && scope.code === "FORUM_UGC", "forum UGC scope check failed");

  console.log("P0 smoke checks passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
