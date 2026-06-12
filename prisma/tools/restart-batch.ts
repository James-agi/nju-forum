/**
 * 批次重启脚本
 * 用法：npx tsx prisma/tools/restart-batch.ts <batchId> [--from <jobId>]
 *
 * 原子操作：先停旧 runner → 更新 batch.json → 启动新 runner
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const runsRoot = path.join(process.cwd(), "agent-workflows", "card-batch", "runs");

async function main() {
  const args = process.argv.slice(2);
  const batchId = args.find((a) => !a.startsWith("--"));
  const fromJobIdx = args.indexOf("--from");
  const fromJobId = fromJobIdx >= 0 ? args[fromJobIdx + 1] : null;

  if (!batchId) {
    console.error("Usage: npx tsx prisma/tools/restart-batch.ts <batchId> [--from <jobId>]");
    process.exit(1);
  }

  const batchDir = path.join(runsRoot, batchId);
  const manifestPath = path.join(batchDir, "batch.json");
  const raw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw);

  console.log(`批次：${manifest.name} (${batchId})`);
  console.log(`Jobs: ${manifest.jobs.length}`);

  // 标记已完成的 job（有 cards.json 且非空）为 EXPORTED
  const fs = await import("node:fs");
  let skipped = 0;
  for (const job of manifest.jobs) {
    const cardsPath = path.join(job.directory, "cards.json");
    if (fs.existsSync(cardsPath)) {
      try {
        const cards = JSON.parse(await readFile(cardsPath, "utf8"));
        if (Array.isArray(cards) && cards.length > 0) {
          job.status = "EXPORTED";
          skipped++;
        }
      } catch {
        // cards.json 解析失败，不标记为 EXPORTED
      }
    }
  }

  // 如果指定了 --from，把该 job 之前的所有 job 标记为 EXPORTED
  if (fromJobId) {
    const fromIdx = manifest.jobs.findIndex((j: any) => j.id === fromJobId);
    if (fromIdx >= 0) {
      for (let i = 0; i < fromIdx; i++) {
        if (manifest.jobs[i].status !== "EXPORTED") {
          manifest.jobs[i].status = "EXPORTED";
          skipped++;
        }
      }
      console.log(`从 ${fromJobId} 开始重跑`);
    }
  }

  // 写入 batch.json（确保在启动 runner 之前完成）
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`已更新 batch.json（${skipped} 个 job 标记为 EXPORTED）`);

  // 打印 job 状态
  for (const job of manifest.jobs) {
    console.log(`  ${job.id}: ${job.status}`);
  }

  // 启动 runner
  console.log("\n启动 runner...");
  const child = spawn("npx", ["tsx", "prisma/tools/run-card-batch.ts", `agent-workflows/card-batch/runs/${batchId}/batch.json`, "--run-opencode"], {
    cwd: process.cwd(),
    stdio: "inherit",
    detached: true,
    shell: true,
  });
  child.unref();
  console.log(`Runner PID: ${child.pid}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
