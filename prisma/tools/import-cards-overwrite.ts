import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { db } from "../../src/lib/db";
import { cardCreateSchema, formatValidationError } from "../../src/lib/knowledge/validation";

async function main() {
  const batchDir = process.argv[2];
  if (!batchDir) {
    console.error("用法: npx.cmd tsx prisma/tools/import-cards-overwrite.ts <batch-dir>");
    process.exit(1);
  }

  // Find an admin user for card creator
  const adminUser = await db.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, name: true },
  });
  if (!adminUser) {
    console.error("未找到 ADMIN 用户，无法入库");
    process.exit(1);
  }
  console.log(`使用管理员: ${adminUser.name} (${adminUser.id})`);

  const allCardsPath = path.join(batchDir, "exports", "all-cards.json");
  const reportPath = path.join(batchDir, "exports", "import-report.md");

  const raw = readFileSync(allCardsPath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    console.error("all-cards.json 必须是数组");
    process.exit(1);
  }

  const reportLines = [
    "# 批量入库报告（覆盖模式）",
    "",
    `目录：${batchDir}`,
    `时间：${new Date().toISOString()}`,
    "",
    "## 统计",
    "",
    "| 类型 | 数量 |",
    "|------|------|",
  ];
  let created = 0;
  let updated = 0;
  let failed = 0;
  const details: Array<{ index: number; result: string; summary: string; sourceUrl: string; note: string }> = [];

  for (let index = 0; index < parsed.length; index += 1) {
    const item = parsed[index];
    const parsedCard = cardCreateSchema.safeParse({
      ...item,
      verificationStatus: "NEEDS_REVIEW",
    });

    if (!parsedCard.success) {
      failed += 1;
      details.push({
        index: index + 1,
        result: "失败",
        summary: item.summary || "-",
        sourceUrl: item.sourceUrl || "-",
        note: formatValidationError(parsedCard.error),
      });
      continue;
    }

    const existing = await db.knowledgeCard.findFirst({
      where: { summary: parsedCard.data.summary, archivedAt: null },
      select: { id: true },
    });

    if (existing) {
      await db.knowledgeCard.update({
        where: { id: existing.id },
        data: {
          body: parsedCard.data.body,
          sourceExcerpt: parsedCard.data.sourceExcerpt ?? null,
          sourceDescription: parsedCard.data.sourceDescription ?? null,
          sourceType: parsedCard.data.sourceType ?? "OTHER",
          domainTag: parsedCard.data.domainTag ?? null,
          verificationStatus: "NEEDS_REVIEW",
        },
      });
      updated += 1;
      details.push({
        index: index + 1,
        result: "更新",
        summary: parsedCard.data.summary,
        sourceUrl: parsedCard.data.sourceUrl || "-",
        note: `覆盖已有卡片 (ID: ${existing.id})`,
      });
    } else {
      const sourceUrls = parsedCard.data.sourceUrls
        || (parsedCard.data.sourceUrl ? [parsedCard.data.sourceUrl] : null);
      const newCard = await db.knowledgeCard.create({
        data: {
          ...parsedCard.data,
          sourceUrls: sourceUrls ? JSON.stringify(sourceUrls) : null,
          verificationStatus: "NEEDS_REVIEW",
          sourceUrl: parsedCard.data.sourceUrl ?? null,
          createdById: adminUser.id,
        },
      });
      created += 1;
      details.push({
        index: index + 1,
        result: "创建",
        summary: parsedCard.data.summary,
        sourceUrl: parsedCard.data.sourceUrl || "-",
        note: `NEEDS_REVIEW (ID: ${newCard.id})`,
      });
    }
  }

  // 添加统计信息
  reportLines.push(`| 创建 | ${created} |`);
  reportLines.push(`| 更新 | ${updated} |`);
  reportLines.push(`| 失败 | ${failed} |`);
  reportLines.push(`| 总计 | ${created + updated + failed} |`);
  reportLines.push("");
  reportLines.push("## 详细记录");
  reportLines.push("");
  reportLines.push("| # | 结果 | summary | sourceUrl | 说明 |");
  reportLines.push("|---|------|---------|-----------|------|");

  // 添加详细信息
  for (const d of details) {
    const summaryShort = d.summary.length > 50 ? d.summary.substring(0, 50) + "..." : d.summary;
    const sourceUrlShort = d.sourceUrl.length > 60 ? "..." + d.sourceUrl.slice(-57) : d.sourceUrl;
    reportLines.push(
      `| ${d.index} | ${d.result} | ${summaryShort} | ${sourceUrlShort} | ${d.note} |`
    );
  }

  writeFileSync(reportPath, `${reportLines.join("\n")}\n`, "utf8");

  console.log(`入库完成：创建 ${created}，更新 ${updated}，失败 ${failed}`);
  console.log(`报告：${reportPath}`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
