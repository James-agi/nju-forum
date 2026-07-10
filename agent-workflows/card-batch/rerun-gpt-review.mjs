// 对指定 job 重跑 GPT 审查（可复用）
// 用法: node rerun-gpt-review.mjs <batch-dir> <job-slug>
// 例: node rerun-gpt-review.mjs card-batch-20260605-073627 004-常见疑问汇总
//
// 自动分批发送，每批 2 张卡片，避免大 payload 导致网关超时。
// 结果写入 job 目录下的 gpt-review.md。

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const settingsPath = path.join(__dirname, "settings.local.json");
if (!existsSync(settingsPath)) {
  console.error("settings.local.json 不存在，请先配置 GPT API");
  process.exit(1);
}
const settings = JSON.parse(await readFile(settingsPath, "utf8"));

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("用法: node rerun-gpt-review.mjs <batch-dir> <job-slug>");
  console.error('例: node rerun-gpt-review.mjs card-batch-20260605-073627 004-常见疑问汇总');
  process.exit(1);
}

const [batchDirName, jobSlug] = args;
const batchDir = path.join(__dirname, "runs", batchDirName);
const jobDir = path.join(batchDir, "jobs", jobSlug);

if (!existsSync(batchDir)) {
  console.error("批次目录不存在：" + batchDir);
  process.exit(1);
}
if (!existsSync(jobDir)) {
  console.error("任务目录不存在：" + jobDir);
  process.exit(1);
}

const cardsPath = path.join(jobDir, "cards.json");
if (!existsSync(cardsPath)) {
  console.error("cards.json 不存在：" + cardsPath);
  process.exit(1);
}

const batchJsonPath = path.join(batchDir, "batch.json");
const jobSourceUrl = existsSync(batchJsonPath)
  ? (() => {
      const batch = JSON.parse(require("fs").readFileSync(batchJsonPath, "utf8"));
      const job = batch.jobs?.find((j) => j.slug === jobSlug);
      return job?.source?.url || "(未知)";
    })()
  : "(未知)";

const cards = JSON.parse(await readFile(cardsPath, "utf8"));
console.log(`任务: ${jobSlug}`);
console.log(`来源: ${jobSourceUrl}`);
console.log(`卡片: ${cards.length} 张`);
console.log(`API: ${settings.apiUrl} (${settings.model})`);
console.log("");

const reviewPrompt = settings.reviewPrompt || "以南京大学新生视角审查这些卡片：能否直接解决问题？缺步骤/时机建议/踩坑提醒？语气是否像通知？输出具体修改建议。";

const BATCH_SIZE = 2;
const allReviews = [];
let failed = 0;

for (let i = 0; i < cards.length; i += BATCH_SIZE) {
  const batch = cards.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  const totalBatches = Math.ceil(cards.length / BATCH_SIZE);
  const label = `第 ${batchNum}/${totalBatches} 批 (卡片 ${i + 1}-${Math.min(i + BATCH_SIZE, cards.length)})`;

  process.stdout.write(`${label} ... `);

  const body = {
    model: settings.model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: "你是以南京大学新生用户视角审查知识卡片的审稿人。只根据给出的卡片和来源字段提出问题，不要编造事实。",
      },
      {
        role: "user",
        content: [
          reviewPrompt,
          "",
          `来源 URL：${jobSourceUrl}`,
          "",
          JSON.stringify(batch, null, 2),
        ].join("\n"),
      },
    ],
  };

  try {
    const response = await fetch(settings.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });

    if (!response.ok) {
      const text = await response.text();
      console.log(`❌ HTTP ${response.status}: ${text.slice(0, 120)}`);
      failed++;
      continue;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";

    if (!content.trim()) {
      console.log("❌ 返回为空");
      failed++;
      continue;
    }

    allReviews.push(`## ${label}\n\n${content.trim()}`);
    console.log(`✅ (${content.length} 字符)`);
  } catch (err) {
    console.log(`❌ ${err.message}`);
    failed++;
  }
}

if (allReviews.length === 0) {
  console.error("\n所有批次均失败");
  process.exit(1);
}

const finalReview = allReviews.join("\n\n---\n\n");
const reviewPath = path.join(jobDir, "gpt-review.md");
await writeFile(reviewPath, finalReview + "\n", "utf8");

const totalBatches = Math.ceil(cards.length / BATCH_SIZE);
console.log(`\n完成: ${allReviews.length}/${totalBatches} 批成功, ${failed} 批失败`);
console.log(`输出: ${reviewPath}`);
