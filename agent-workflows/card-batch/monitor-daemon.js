// Background batch monitor daemon. Start once, then read .monitor-status.md.
// Usage: node agent-workflows/card-batch/monitor-daemon.js [--once] [batchId]
//   --once   Run once and exit (for testing)
//   batchId  Monitor specific batch, or omit for all recent

const fs = require("fs");
const path = require("path");
const http = require("http");

const runsDir = path.join(__dirname, "runs");
const statusFile = path.join(runsDir, ".monitor-status.md");
const intervalMs = 30_000;
const maxInactiveBatches = 5; // show this many most recent

function checkOpendex() {
  return new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:4096", (r) => {
      let body = "";
      r.on("data", (c) => (body += c));
      r.on("end", () => resolve(r.statusCode === 200));
    });
    req.on("error", () => resolve(false));
    req.setTimeout(8000, () => { req.destroy(); resolve(false); });
  });
}

function listBatches() {
  if (!fs.existsSync(runsDir)) return [];
  return fs.readdirSync(runsDir)
    .filter((d) => d.startsWith("card-batch-") && fs.existsSync(path.join(runsDir, d, "batch.json")))
    .sort()
    .slice(-maxInactiveBatches);
}

function getBatchInfo(dir) {
  try {
    const root = path.join(runsDir, dir);
    const batch = JSON.parse(fs.readFileSync(path.join(root, "batch.json"), "utf8"));
    let status = fs.existsSync(path.join(root, "web-run-status.json"))
      ? JSON.parse(fs.readFileSync(path.join(root, "web-run-status.json"), "utf8"))
      : null;

    // CLI runner doesn't write web-run-status.json — infer status from job directories
    if (!status) {
      const jobsDir = path.join(root, "jobs");
      const hasAnyOutput = fs.existsSync(jobsDir) && fs.readdirSync(jobsDir).some(d => {
        const jp = path.join(jobsDir, d);
        return fs.statSync(jp).isDirectory() && fs.readdirSync(jp).some(f => f.startsWith("transcript"));
      });
      const jobStatuses = (batch.jobs || []).map(j => j.status);
      const allDone = jobStatuses.every(s => s === "EXPORTED");
      const anyFailed = jobStatuses.some(s => s === "FAILED");

      if (batch.error || batch.ended) {
        status = { status: allDone ? "DONE" : "FAILED", error: batch.error };
      } else if (allDone) {
        status = { status: "DONE" };
      } else if (hasAnyOutput) {
        status = { status: "RUNNING" };
      } else if (anyFailed) {
        status = { status: "FAILED" };
      }
    }

    const jobs = [];
    const jobsDir = path.join(root, "jobs");
    if (fs.existsSync(jobsDir)) {
      for (const d of fs.readdirSync(jobsDir).sort()) {
        const jp = path.join(jobsDir, d);
        if (!fs.statSync(jp).isDirectory()) continue;
        const files = fs.readdirSync(jp);
        const has = (suf) => files.some((f) => {
          if (f.includes(suf)) return true;
          // CLI runner uses different naming: transcript.md (S1), transcript-02-submit-url.md (S2), transcript-03-compare-source.md (S3)
          if (suf === "transcript-read_prompt_file.md" && f === "transcript.md") return true;
          if (suf === "transcript-submit_url.md" && f.includes("transcript") && f.includes("submit")) return true;
          if (suf === "transcript-compare_source.md" && f.includes("transcript") && f.includes("compare")) return true;
          return false;
        });
        let cards = 0;
        const cp = path.join(jp, "cards.json");
        if (fs.existsSync(cp)) {
          try { cards = JSON.parse(fs.readFileSync(cp, "utf8")).length; } catch { cards = -1; }
        }
        // Find matching job in manifest
        const jobDef = batch.jobs?.find((j) => j.directory?.endsWith(d));

        // Followup status (total submitted vs processed)
        let fwTotal = 0;
        const fwDir = path.join(jp, "followups");
        if (fs.existsSync(fwDir)) {
          fwTotal = fs.readdirSync(fwDir)
            .filter((f) => f.endsWith("-user-prompt.md")).length;
        }
        const fwDone = jobDef?.followupCount ?? 0;
        let fwStr = "";
        if (fwTotal > 0 || fwDone > 0) {
          fwStr = fwDone >= fwTotal ? `${fwTotal}✓` : `${fwDone}/${fwTotal}`;
        }

        // GPT 审查状态检测
        let gptStatus = " "; // 无审查
        const gptFile = path.join(jp, "gpt-review.md");
        if (fs.existsSync(gptFile)) {
          const gptContent = fs.readFileSync(gptFile, "utf8");
          const isEmpty = gptContent.includes("空数组") || gptContent.includes("没有卡片") || gptContent.includes("cards.json 是空");
          const hasFollowupIteration = fs.existsSync(path.join(jp, "transcript-gpt-review-iteration.md"));
          if (isEmpty && hasFollowupIteration) {
            gptStatus = "⚠️"; // 初始空卡，GPT 触发重做
          } else if (isEmpty) {
            gptStatus = "❌"; // 空卡且无补救
          } else {
            gptStatus = "✅"; // 正常通过
          }
        }

        jobs.push({
          dir: d,
          label: d.replace(/^\d+-source-/, "job"),
          s1: has("transcript-read_prompt_file.md"),
          s2: has("transcript-submit_url.md"),
          s3: has("transcript-compare_source.md"),
          cards,
          gpt: gptStatus,
          status: jobDef?.status || "?",
          fw: fwStr,
        });
      }
    }

    // Export card count
    let exportCards = 0;
    const expPath = path.join(root, "exports", "all-cards.json");
    if (fs.existsSync(expPath)) {
      try { exportCards = JSON.parse(fs.readFileSync(expPath, "utf8")).length; } catch { /* empty */ }
    }

    return { batch, status, jobs, exportCards };
  } catch {
    return null;
  }
}

function generateReport() {
  const lines = [];
  lines.push(`# Batch Monitor ${new Date().toISOString().replace("T", " ").substring(0, 19)}`);
  lines.push("");

  const batches = listBatches();
  if (batches.length === 0) {
    lines.push("No batches found.");
    return lines.join("\n") + "\n";
  }

  // Collect data
  const data = batches.map((d) => getBatchInfo(d)).filter(Boolean);

  for (const { batch, status, jobs, exportCards } of data) {
    const shortId = batch.id.substring(0, 25);
    const phase = status?.status || "?";
    const icon = phase === "DONE" ? "✅" : phase === "FAILED" ? "❌" : phase === "RUNNING" ? "🔄" : "⏳";

    lines.push(`## ${icon} ${batch.name} (${shortId})`);
    lines.push(`status: **${phase}** | jobs: ${batch.jobs?.length || 0} | concurrency: ${batch.concurrency} | gptReview: ${batch.gptReviewEnabled}`);
    if (status?.startedAt) lines.push(`started: ${status.startedAt.replace("T"," ").substring(0,19)}`);
    if (status?.endedAt) lines.push(`ended: ${status.endedAt.replace("T"," ").substring(0,19)}`);
    if (status?.error) lines.push(`error: ${status.error}`);
    lines.push("");

    if (jobs.length > 0) {
      lines.push("| job | S1 | S2 | S3 | cards | GPT | fw | status |");
      lines.push("|-----|----|----|----|-------|-----|----|--------|");
      for (const j of jobs) {
        lines.push(
          `| ${j.label.padEnd(3)} | ${j.s1 ? "✅" : " "} | ${j.s2 ? "✅" : " "} | ${j.s3 ? "✅" : " "} | ${j.cards >= 0 ? String(j.cards) : "err"} | ${j.gpt} | ${j.fw ? j.fw : " "} | ${j.status} |`
        );
      }
      lines.push("");
    }

    if (exportCards > 0) {
      const expPath = path.join(runsDir, batch.id, "exports");
      const importReport = path.join(expPath, "import-report.md");
      const iterReport = path.join(expPath, "workflow-iteration-report.md");
      lines.push(`**exported cards: ${exportCards}**`);
      if (fs.existsSync(importReport)) lines.push(`import-report: ✅`);
      if (fs.existsSync(iterReport)) lines.push(`iteration-report: ✅`);
      lines.push("");
    }
  }

  return lines.join("\n") + "\n";
}

async function tick() {
  const opencodeUp = await checkOpendex();
  let report = generateReport();
  // Prepend opencode status
  report = `opencode: ${opencodeUp ? "UP" : "❌ DOWN"}\n\n` + report;
  fs.writeFileSync(statusFile, report, "utf8");
}

async function main() {
  const once = process.argv.includes("--once");
  console.log(`Monitor daemon starting (${once ? "once" : `every ${intervalMs / 1000}s`})`);
  console.log(`Status file: ${statusFile}\n`);

  await tick();
  console.log(fs.readFileSync(statusFile, "utf8"));

  if (once) process.exit(0);

  setInterval(async () => {
    try {
      await tick();
    } catch (err) {
      // Don't crash on transient errors
    }
  }, intervalMs);
}

main();
