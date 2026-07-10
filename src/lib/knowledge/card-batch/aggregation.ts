import "server-only";

import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CardBatchJob, CardBatchManifest } from "./types";
import { repairCardsJson } from "./json-repair";

type ExportedCard = Record<string, unknown>;

const VALID_SOURCE_TYPES = new Set([
  "OFFICIAL",
  "DOCUMENT",
  "SENIOR",
  "AUTHOR_EXPERIENCE",
  "OTHER",
]);

function requireString(
  card: ExportedCard,
  key: string,
  issues: string[],
) {
  const value = card[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${key} 不能为空`);
  }
}

export function validateCard(card: ExportedCard, index: number) {
  const issues: string[] = [];
  requireString(card, "summary", issues);
  requireString(card, "body", issues);
  // sourceExcerpt 在 schema 中为可选，聚合校验也不强制必填
  if (typeof card.sourceExcerpt === "string" && card.sourceExcerpt.trim().length > 12000) {
    issues.push("sourceExcerpt 超过 12000 字");
  }
  requireString(card, "sourceDescription", issues);
  requireString(card, "sourceType", issues);
  requireString(card, "domainTag", issues);

  if (typeof card.summary === "string" && card.summary.length > 200) {
    issues.push("summary 超过 200 字");
  }
  if (typeof card.body === "string" && card.body.includes("![")) {
    issues.push("body 里不能放图片 Markdown");
  }
  if (typeof card.sourceType === "string" && !VALID_SOURCE_TYPES.has(card.sourceType)) {
    issues.push("sourceType 不在允许范围");
  }
  if (card.verificationStatus !== "NEEDS_REVIEW") {
    issues.push("verificationStatus 必须是 NEEDS_REVIEW");
  }

  return { index, ok: issues.length === 0, issues };
}

function cardToMarkdown(card: ExportedCard, index: number) {
  return [
    `## ${index}. ${String(card.summary || "未命名卡片")}`,
    "",
    `**domainTag**：${String(card.domainTag || "")}`,
    `**sourceType**：${String(card.sourceType || "")}`,
    `**verificationStatus**：${String(card.verificationStatus || "")}`,
    `**sourceUrl**：${String(card.sourceUrl || "")}`,
    `**sourceDescription**：${String(card.sourceDescription || "")}`,
    "",
    "### body",
    "",
    String(card.body || ""),
    "",
    "### sourceExcerpt",
    "",
    String(card.sourceExcerpt || ""),
    "",
  ].join("\n");
}

export async function readJobCards(
  job: CardBatchJob,
): Promise<{ cards: ExportedCard[]; error: string | null }> {
  const cardsPath = path.join(job.directory, "cards.json");
  if (!existsSync(cardsPath)) {
    return { cards: [], error: "缺少 cards.json" };
  }

  try {
    const raw = await readFile(cardsPath, "utf8");
    const { repaired, fixed } = repairCardsJson(raw);
    if (fixed) {
      // Save repaired version and broken original for debugging
      await writeFile(cardsPath, repaired, "utf8");
      await writeFile(cardsPath.replace(/\.json$/, ".broken.json"), raw, "utf8");
    }
    const parsed = JSON.parse(repaired);
    if (!Array.isArray(parsed)) {
      return { cards: [], error: "cards.json 必须是数组" };
    }
    return { cards: parsed as ExportedCard[], error: null };
  } catch (error) {
    return {
      cards: [],
      error: error instanceof Error ? error.message : "cards.json 解析失败",
    };
  }
}

export async function aggregateBatch(manifest: CardBatchManifest, manifestPath: string) {
  const exportsDirectory = path.join(manifest.rootDirectory, "exports");
  await mkdir(exportsDirectory, { recursive: true });

  const allCards: ExportedCard[] = [];
  const reportLines = [
    "# 批量制卡审核报告",
    "",
    `批次：${manifest.name}`,
    `任务数：${manifest.jobs.length}`,
    "",
    "| 任务 | 状态 | 卡片数 | 校验 | 问题 |",
    "|---|---|---:|---|---|",
  ];

  for (const job of manifest.jobs) {
    const { cards, error } = await readJobCards(job);
    const hasIteration = existsSync(path.join(job.directory, "iteration.md"));
    const validation = cards.map((card, idx) => validateCard(card, idx + 1));
    const issueText = [
      error,
      hasIteration ? null : "缺少 iteration.md",
      ...validation.flatMap((item) =>
        item.issues.map((issue) => `卡片 ${item.index}: ${issue}`),
      ),
    ]
      .filter(Boolean)
      .join("；");

    if (!error && validation.every((item) => item.ok)) {
      job.status = "EXPORTED";
      allCards.push(...cards);
    } else if (existsSync(path.join(job.directory, "cards.json"))) {
      job.status = "FAILED";
      allCards.push(...cards);
    }

    await writeFile(
      path.join(job.directory, "runner-validation.json"),
      JSON.stringify(
        { ok: !issueText, issues: issueText ? issueText.split("；") : [] },
        null,
        2,
      ),
      "utf8",
    );

    reportLines.push(
      `| ${job.id} | ${job.status} | ${cards.length} | ${issueText ? "需处理" : "通过"} | ${issueText || "-"} |`,
    );
  }

  await writeFile(
    path.join(exportsDirectory, "all-cards.json"),
    JSON.stringify(allCards, null, 2),
    "utf8",
  );
  await writeFile(
    path.join(exportsDirectory, "all-cards.md"),
    ["# 批量卡片导出", "", ...allCards.map(cardToMarkdown)].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(exportsDirectory, "review-report.md"),
    `${reportLines.join("\n")}\n`,
    "utf8",
  );

  // Update manifest file atomically
  const tmpManifestPath = manifestPath + ".tmp-" + Math.random().toString(36).slice(2, 8);
  await writeFile(tmpManifestPath, JSON.stringify(manifest, null, 2), "utf8");
  await rename(tmpManifestPath, manifestPath);

  return { totalCards: allCards.length, reportPath: path.join(exportsDirectory, "review-report.md") };
}
