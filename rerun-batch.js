// Standalone script to rerun failed jobs in a batch via opencode API
// Usage: node rerun-batch.js [batchId]

const fs = require("fs");
const path = require("path");
const http = require("http");

const BATCH_ID = process.argv[2] || "card-batch-20260606-151545";
const OPENCODE_PORT = 4096;
const runsDir = path.join(__dirname, "agent-workflows", "card-batch", "runs");
const batchDir = path.join(runsDir, BATCH_ID);
const manifestPath = path.join(batchDir, "batch.json");

function apiCall(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: "127.0.0.1",
      port: OPENCODE_PORT,
      path: urlPath,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => {
        if (res.statusCode >= 400)
          return reject(new Error(`${res.statusCode} ${buf.slice(0, 200)}`));
        resolve(JSON.parse(buf));
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function atomicWrite(filePath, data) {
  const tmp = filePath + ".tmp-" + Math.random().toString(36).slice(2, 8);
  fs.writeFileSync(tmp, data, "utf8");
  fs.renameSync(tmp, filePath);
}

const OUTPUT_CONTRACT = `## 输出文件协议

在任务目录写出以下文件：

\`\`\`text
cards.json
cards.md
iteration.md
\`\`\`

cards.json 必须是数组，每张卡格式如下：

\`\`\`json
[
  {
    "summary": "问题形状摘要，不超过 200 字",
    "body": "正文，仅文字。body 中绝对不能出现 ![]( 图片 Markdown，所有图片一律放 sourceExcerpt",
    "sourceExcerpt": "逐字原文片段、超链接和本地图片 Markdown 引用",
    "sourceUrl": "https://example.com/source",
    "sourceDescription": "带年份/版本的来源说明",
    "sourceType": "OFFICIAL | DOCUMENT | SENIOR | AUTHOR_EXPERIENCE | OTHER",
    "domainTag": "选课规则 | 校园服务 | 院系结构 | 保研转专业 | 竞赛科研 | 生活指南 | 其他",
    "verificationStatus": "NEEDS_REVIEW"
  }
]
\`\`\``;

const PHASE_LABELS = {
  read_prompt_file: "阶段一：读取 Prompt 文件",
  submit_url: "阶段二：提交来源 URL",
  compare_source: "阶段三：比对来源",
};

const PHASE_ORDER = ["read_prompt_file", "submit_url", "compare_source"];

function buildPrompt(manifestId, job, phase) {
  const lines = [
    `# ${PHASE_LABELS[phase]}`,
    "",
    `批次：${manifestId}`,
    `任务：${job.id || job.slug}`,
    `任务目录：${job.directory}`,
    "",
    "- 工作目录是项目根目录 D:\\nju-forum。",
    "- 不要直接写数据库，不要把卡片标为 VERIFIED。",
    "- 所有导出的卡片 verificationStatus 一律为 NEEDS_REVIEW。",
    "",
    "**批处理模式：你是无人值守的批处理 agent，不要停下来向用户提问，不要等待确认。" +
      "所有决定自己做出，遇到冲突选最保守方案。" +
      "若判断来源已被现有卡充分覆盖，直接创建空 cards.json（内容为 []）并在 iteration.md 说明跳过原因，然后结束任务。**",
  ];

  if (phase === "submit_url" && job.source) {
    lines.push(
      "",
      "## 本轮来源",
      "",
      `来源 URL：${job.source.url}`,
      `来源标题：${job.source.title || "未提供，需从网页主题判断"}`,
      "",
      ...OUTPUT_CONTRACT.split("\n"),
    );
  }

  if (phase === "compare_source") {
    lines.push("", ...OUTPUT_CONTRACT.split("\n"));
  }

  if (phase === "compare_source") {
    lines.push(
      "",
      "## 结束前自检",
      "",
      "- 是否和原文细致比对过？",
      "- 是否做到不重不漏？",
      "- cards.json 覆盖的原文摘要是否覆盖原文大部分内容？",
      "- 剩余未覆盖内容是否确实无关紧要？",
      "- iteration.md 是否记录了本轮自审和可沉淀规则？",
      "- 是否所有卡都是 NEEDS_REVIEW？",
      "- 每张卡的 body 中是否都不包含 ![]( 图片 Markdown？（所有图片必须放 sourceExcerpt）",
    );
  }

  return lines.join("\n") + "\n";
}

async function writeTranscript(jobDir, stage, parts) {
  const transcriptPath = path.join(jobDir, `transcript-${stage}.md`);
  const content = parts
    .filter((p) => p.type === "text" || p.type === "reasoning")
    .map((p) => `[${p.type}]\n${p.text ?? ""}\n`)
    .join("\n");
  fs.writeFileSync(transcriptPath, content, "utf8");
}

async function runJob(manifest, job) {
  const jobDir = job.directory;
  fs.mkdirSync(jobDir, { recursive: true });

  console.log(`  Running job: ${job.slug || job.id}...`);

  // Create session
  const session = await apiCall("POST", "/session", {
    title: `rerun-${manifest.id}-job-${job.slug || job.id}`,
  });
  fs.writeFileSync(path.join(jobDir, "session-id.txt"), session.id + "\n", "utf8");

  for (const phase of PHASE_ORDER) {
    const prompt = buildPrompt(manifest.id, job, phase);
    fs.writeFileSync(path.join(jobDir, `prompt-${phase}.md`), prompt, "utf8");

    console.log(`    ${phase}...`);
    const result = await apiCall("POST", `/session/${session.id}/message`, {
      agent: "build",
      parts: [{ type: "text", text: prompt }],
    });

    await writeTranscript(jobDir, phase, result.parts);

    if (result.info.finish !== "stop" && result.info.finish !== "end_turn") {
      throw new Error(`Stage ${phase} finished with unexpected status: ${result.info.finish}`);
    }
  }

  // Check cards.json
  const cardsPath = path.join(jobDir, "cards.json");
  if (!fs.existsSync(cardsPath)) {
    throw new Error(`OpenCode did not generate cards.json`);
  }

  console.log(`  Job ${job.slug || job.id} done.`);
}

async function main() {
  console.log(`Rerunning failed jobs in batch: ${BATCH_ID}`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const failedJobs = manifest.jobs.filter(
    (j) => j.status !== "EXPORTED" && j.status !== "DONE" && !j.closed,
  );

  console.log(`Found ${failedJobs.length} failed jobs out of ${manifest.jobs.length} total.`);

  if (failedJobs.length === 0) {
    console.log("No failed jobs to rerun.");
    return;
  }

  for (const job of failedJobs) {
    try {
      job.status = "RUNNING";
      atomicWrite(manifestPath, JSON.stringify(manifest, null, 2));

      await runJob(manifest, job);

      job.status = "EXPORTED";
      atomicWrite(manifestPath, JSON.stringify(manifest, null, 2));
    } catch (err) {
      console.error(`  Job FAILED: ${err.message}`);
      job.status = "FAILED";
      atomicWrite(manifestPath, JSON.stringify(manifest, null, 2));
    }
  }

  console.log("\nDone. Final status:");
  for (const j of manifest.jobs) {
    console.log(`  ${j.slug || j.id}: ${j.status}`);
  }
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
