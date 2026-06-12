// Read-only batch monitor. Usage: node agent-workflows/card-batch/monitor.js [batchId]
// If batchId omitted, monitors the latest batch.

const fs = require("fs");
const path = require("path");
const http = require("http");

const runsDir = path.join(__dirname, "runs");

function checkOpendex() {
  return new Promise((resolve) => {
    http.get("http://127.0.0.1:4096", (r) => resolve(r.statusCode === 200))
      .on("error", () => resolve(false));
  });
}

function getLatest() {
  const dirs = fs.readdirSync(runsDir).sort();
  return dirs[dirs.length - 1] || null;
}

// 解析 transcript 中的 FETCH REPORT
function parseFetchReport(transcriptPath) {
  if (!fs.existsSync(transcriptPath)) return null;

  const content = fs.readFileSync(transcriptPath, "utf8");

  // 查找 FETCH REPORT 区块
  const reportMatch = content.match(/┌─+[\s\S]*?FETCH REPORT[\s\S]*?└─+/);
  if (!reportMatch) return null;

  const reportBlock = reportMatch[0];

  // 解析关键信息
  const result = {
    method: null,
    success: null,
    quality: null,
    deviation: null,
    steps: [],
  };

  // Final Method
  const methodMatch = reportBlock.match(/│ Final Method:\s*(.+)/);
  if (methodMatch) result.method = methodMatch[1].trim();

  // Success
  const successMatch = reportBlock.match(/│ Success:\s*(✅|❌)/);
  if (successMatch) result.success = successMatch[1] === "✅";

  // Quality
  const qualityMatch = reportBlock.match(/│ Quality:\s*(\w+)/);
  if (qualityMatch) result.quality = qualityMatch[1];

  // Deviation
  const deviationMatch = reportBlock.match(/│ ⚠️\s*DEVIATION:\s*(.+)/);
  if (deviationMatch) result.deviation = deviationMatch[1].trim();

  // Steps — supports optional (reason) and optional [duration]
  const stepsRegex = /│\s+(✅|❌|⏭️|↩️)\s+(\w+):\s+(\w+)(?:\s+\((.+?)\))?(?:\s+\[(.+?)\])?/g;
  let stepMatch;
  while ((stepMatch = stepsRegex.exec(reportBlock)) !== null) {
    result.steps.push({
      icon: stepMatch[1],
      name: stepMatch[2],
      status: stepMatch[3],
      reason: stepMatch[4] || null,
      duration: stepMatch[5] || null,
    });
  }

  return result;
}

function monitor(batchId) {
  const id = batchId || getLatest();
  if (!id) { console.log("No batches found."); process.exit(1); }

  const root = path.join(runsDir, id);
  if (!fs.existsSync(root)) { console.log(`Batch not found: ${id}`); process.exit(1); }

  const statusPath = path.join(root, "web-run-status.json");
  const batchJsonPath = path.join(root, "batch.json");

  // Header
  const batch = JSON.parse(fs.readFileSync(batchJsonPath, "utf8"));
  console.log(`=== ${batch.name} (${batch.id}) ===`);
  console.log(`jobs: ${batch.jobs.length} | concurrency: ${batch.concurrency} | gptReview: ${batch.gptReviewEnabled}\n`);

  // Per-job progress
  const jobsDir = path.join(root, "jobs");
  const fetchDeviations = [];  // 收集所有 fetch 偏离信息
  const fetchSummaries = [];   // 收集所有 fetch 结果摘要

  if (fs.existsSync(jobsDir)) {
    const jobDirs = fs.readdirSync(jobsDir).sort();
    console.log("job  S1 S2 S3 CARDS GPT FW  status");
    console.log("----  -- -- -- ----- --- ---  ------");
    for (const d of jobDirs) {
      const jp = path.join(jobsDir, d);
      const files = fs.readdirSync(jp);
      const has = (suffix) => files.some((f) => f.includes(suffix));
      const s1 = has("transcript-read_prompt_file.md") ? "✓" : " ";
      const s2 = has("transcript-submit_url.md") ? "✓" : " ";
      const s3 = has("transcript-compare_source.md") ? "✓" : " ";
      let cards = " ";
      if (files.includes("cards.json")) {
        try {
          const c = JSON.parse(fs.readFileSync(path.join(jp, "cards.json"), "utf8"));
          cards = String(c.length);
        } catch { cards = "err"; }
      }
      const gpt = has("gpt-review.md") ? "✓" : " ";
      const job = batch.jobs.find((j) => j.slug === d || j.directory?.endsWith(d));
      const rawStatus = job?.status || "?";
      const status = job?.closed ? `CLOSED(${job.closed})` : rawStatus;
      // Followup status
      let fwStr = " ";
      const fwDir = path.join(jp, "followups");
      if (fs.existsSync(fwDir)) {
        const fwTotal = fs.readdirSync(fwDir).filter((f) => f.endsWith("-user-prompt.md")).length;
        const fwDone = job?.followupCount ?? 0;
        if (fwTotal > 0 || fwDone > 0) {
          fwStr = fwDone >= fwTotal ? `${fwTotal}v` : `${fwDone}/${fwTotal}`;
        }
      }
      const label = d.replace(/^\d+-source-\d+$/, (m) => m.replace("source-", "job"));
      console.log(`${label.padEnd(5)} ${s1.padStart(2)} ${s2.padStart(2)} ${s3.padStart(2)} ${cards.padStart(5)} ${gpt.padStart(3)} ${fwStr.padStart(3)}  ${status}`);

      // 解析 FETCH REPORT（可能在 transcript 或 err.log 中）
      const transcriptPath = path.join(jp, "transcript-submit_url.md");
      const errLogPath = path.join(jp, "agent-submit_url.err.log");
      let fetchReport = parseFetchReport(transcriptPath);
      if (!fetchReport) fetchReport = parseFetchReport(errLogPath);
      if (fetchReport && fetchReport.deviation) {
        fetchDeviations.push({
          job: label,
          deviation: fetchReport.deviation,
          method: fetchReport.method,
          success: fetchReport.success,
        });
      }
      if (fetchReport) {
        fetchSummaries.push({
          job: label,
          success: fetchReport.success,
          method: fetchReport.method,
          quality: fetchReport.quality,
          deviation: fetchReport.deviation,
        });
      }
    }
  }

  // Fetch deviations summary
  if (fetchDeviations.length > 0) {
    console.log("\n--- Fetch 偏离报告 ---");
    for (const d of fetchDeviations) {
      const icon = d.success ? "⚠️" : "❌";
      console.log(`${icon} ${d.job}: ${d.deviation} (最终方法: ${d.method || "unknown"})`);
    }
  }

  // Fetch results summary (all jobs with FETCH REPORT)
  if (fetchSummaries.length > 0) {
    const successCount = fetchSummaries.filter(s => s.success).length;
    const failCount = fetchSummaries.filter(s => !s.success).length;
    const devCount = fetchSummaries.filter(s => s.deviation).length;
    if (fetchSummaries.length <= 15) {
      // 少于15个job，逐个显示
      console.log(`\n--- Fetch 结果 (${successCount}✅ ${failCount}❌ ${devCount}⚠️) ---`);
      for (const s of fetchSummaries) {
        const icon = s.success ? "✅" : "❌";
        const dev = s.deviation ? ` ⚠️${s.deviation.slice(0,40)}` : "";
        console.log(`${icon} ${s.job}: ${s.method || "?"}${dev}`);
      }
    } else {
      // 多于15个job，只显示统计和异常
      console.log(`\n--- Fetch 结果: ${successCount}✅ ${failCount}❌ ${devCount}⚠️ / ${fetchSummaries.length} jobs ---`);
    }
  }

  // Batch status
  if (fs.existsSync(statusPath)) {
    const status = JSON.parse(fs.readFileSync(statusPath, "utf8"));
    console.log(`\nbatch: ${status.status}`);
    if (status.startedAt) console.log(`started: ${status.startedAt}`);
    if (status.endedAt) console.log(`ended: ${status.endedAt}`);
    if (status.error) console.log(`error: ${status.error}`);
  }

  // Closed jobs summary
  const closedJobs = batch.jobs.filter(j => j.closed);
  if (closedJobs.length > 0) {
    console.log(`\n--- ${closedJobs.length} jobs closed (won't rerun) ---`);
    for (const j of closedJobs) {
      console.log(`  ${j.id}: [${j.closed}] ${j.closedReason || ""}`);
    }
  }

  // Exported cards
  const exportPath = path.join(root, "exports", "all-cards.json");
  if (fs.existsSync(exportPath)) {
    try {
      const cards = JSON.parse(fs.readFileSync(exportPath, "utf8"));
      if (cards.length > 0) {
        console.log(`\n--- ${cards.length} cards exported ---`);
        cards.forEach((c, i) => console.log(`${i + 1}. [${c.domainTag || "?"}] ${c.summary || "(no summary)"}`));
      }
    } catch { /* empty or broken */ }
  }

  // Import report
  const importReportPath = path.join(root, "exports", "import-report.md");
  if (fs.existsSync(importReportPath)) {
    try {
      const importReport = fs.readFileSync(importReportPath, "utf8");
      // 解析统计信息
      const createdMatch = importReport.match(/\| 创建 \| (\d+) \|/);
      const updatedMatch = importReport.match(/\| 更新 \| (\d+) \|/);
      const failedMatch = importReport.match(/\| 失败 \| (\d+) \|/);
      const totalMatch = importReport.match(/\| 总计 \| (\d+) \|/);

      const created = createdMatch ? parseInt(createdMatch[1]) : 0;
      const updated = updatedMatch ? parseInt(updatedMatch[1]) : 0;
      const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
      const total = totalMatch ? parseInt(totalMatch[1]) : 0;

      console.log(`\n--- import report ---`);
      console.log(`创建: ${created} | 更新: ${updated} | 失败: ${failed} | 总计: ${total}`);

      // 如果有失败的卡片，显示失败详情
      if (failed > 0) {
        const failedLines = importReport.split("\n").filter(line => line.includes("| 失败 |"));
        if (failedLines.length > 0) {
          console.log("\n失败卡片:");
          failedLines.forEach(line => {
            const parts = line.split("|").map(p => p.trim()).filter(p => p);
            if (parts.length >= 4) {
              console.log(`  - ${parts[2]}: ${parts[4] || "未知原因"}`);
            }
          });
        }
      }
    } catch { /* empty or broken */ }
  } else {
    console.log("\n--- import report: 未找到 ---");
  }

  console.log();
}

// Main
checkOpendex().then((ok) => {
  console.log(`opencode: ${ok ? "UP" : "DOWN"}\n`);
  monitor(process.argv[2]);
});
