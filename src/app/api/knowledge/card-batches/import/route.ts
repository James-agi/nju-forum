import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireKnowledgeAuthor } from "@/lib/knowledge/authz";
import { cardCreateSchema, formatValidationError } from "@/lib/knowledge/validation";
import { readCardBatch } from "@/lib/knowledge/card-batch/storage";
import type { CardBatchImportResponse } from "@/lib/knowledge/card-batch/types";
import { startWorkflowIterationWebRun } from "@/lib/knowledge/card-batch/web-runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const authz = await requireKnowledgeAuthor();
    if (!authz.ok) return authz.response;

    const payload = await req.json();
    const batch = await readCardBatch(String(payload.batchId || ""));
    const exportPath = path.join(batch.rootDirectory, "exports", "all-cards.json");
    const reportPath = path.join(batch.rootDirectory, "exports", "import-report.md");
    const raw = await readFile(exportPath, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return NextResponse.json({ error: "all-cards.json 必须是数组" }, { status: 400 });
    }

    const reportLines = [
      "# 批量入库报告",
      "",
      `批次：${batch.name}`,
      "",
      "| # | 结果 | summary | 说明 |",
      "|---|---|---|---|",
    ];
    let created = 0;
    let merged = 0;
    let skipped = 0;
    let failed = 0;

    // 在事务中执行全部 DB 操作，失败时整体回滚
    await db.$transaction(async (tx) => {
      for (let index = 0; index < parsed.length; index += 1) {
        const item = parsed[index];
        const parsedCard = cardCreateSchema.safeParse({
          ...item,
          verificationStatus: "NEEDS_REVIEW",
        });

        if (!parsedCard.success) {
          failed += 1;
          reportLines.push(
            `| ${index + 1} | 失败 | - | ${formatValidationError(parsedCard.error)} |`
          );
          continue;
        }

        // 合并模式：AI 明确指示合并到已有卡片
        if (parsedCard.data.action === "merge" && parsedCard.data.mergeWithSummary) {
          const existing = await tx.knowledgeCard.findFirst({
            where: { summary: parsedCard.data.mergeWithSummary, archivedAt: null },
            select: { id: true, sourceUrl: true, sourceUrls: true },
          });

          if (existing) {
            // 合并 sourceUrls
            const existingUrls: string[] = existing.sourceUrls
              ? JSON.parse(existing.sourceUrls)
              : existing.sourceUrl ? [existing.sourceUrl] : [];
            const newUrls: string[] = parsedCard.data.sourceUrls
              || (parsedCard.data.sourceUrl ? [parsedCard.data.sourceUrl] : []);
            const mergedUrls = Array.from(new Set([...existingUrls, ...newUrls]));

            const updateData: Record<string, unknown> = {
              body: parsedCard.data.body,
              verificationStatus: "NEEDS_REVIEW",
              sourceUrls: JSON.stringify(mergedUrls),
            };
            if (parsedCard.data.sourceUrl) {
              updateData.sourceUrl = parsedCard.data.sourceUrl;
            }
            if (parsedCard.data.sourceExcerpt !== undefined) {
              updateData.sourceExcerpt = parsedCard.data.sourceExcerpt || null;
            }
            if (parsedCard.data.sourceDescription !== undefined) {
              updateData.sourceDescription = parsedCard.data.sourceDescription || null;
            }
            if (parsedCard.data.sourceType !== undefined) {
              updateData.sourceType = parsedCard.data.sourceType;
            }
            if (parsedCard.data.domainTag !== undefined) {
              updateData.domainTag = parsedCard.data.domainTag;
            }

            await tx.knowledgeCard.update({
              where: { id: existing.id },
              data: updateData,
            });
            merged += 1;
            reportLines.push(
              `| ${index + 1} | 合并 | ${parsedCard.data.summary} | 合并到「${parsedCard.data.mergeWithSummary}」 |`
            );
            continue;
          }
          // 找不到目标卡片 → 降级为新建
        }

        // 新建模式
        const { action, mergeWithSummary, ...cardFields } = parsedCard.data;
        const sourceUrls = cardFields.sourceUrls
          || (cardFields.sourceUrl ? [cardFields.sourceUrl] : null);

        await tx.knowledgeCard.create({
          data: {
            ...cardFields,
            sourceUrls: sourceUrls ? JSON.stringify(sourceUrls) : null,
            verificationStatus: "NEEDS_REVIEW",
            sourceUrl: cardFields.sourceUrl ?? null,
            createdById: authz.user.id,
          },
        });

        created += 1;
        reportLines.push(
          `| ${index + 1} | 创建 | ${parsedCard.data.summary} | NEEDS_REVIEW |`
        );
      }
    });

    await writeFile(reportPath, `${reportLines.join("\n")}\n`, "utf8");
    await startWorkflowIterationWebRun(batch.id);

    const response: CardBatchImportResponse = {
      created,
      merged,
      skipped,
      failed,
      reportPath,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error importing card batch:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "批量入库失败" },
      { status: 400 }
    );
  }
}
