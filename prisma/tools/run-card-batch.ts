import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type {
  CardBatchJob,
  CardBatchManifest,
} from "../../src/lib/knowledge/card-batch/types";
import { readGptSettings } from "../../src/lib/knowledge/card-batch/settings";

type ExportedCard = {
  summary?: unknown;
  body?: unknown;
  sourceExcerpt?: unknown;
  sourceUrl?: unknown;
  sourceDescription?: unknown;
  sourceType?: unknown;
  domainTag?: unknown;
  verificationStatus?: unknown;
};

const VALID_SOURCE_TYPES = new Set([
  "OFFICIAL",
  "DOCUMENT",
  "SENIOR",
  "AUTHOR_EXPERIENCE",
  "OTHER",
]);

const LEGACY_AGENT_COMMAND_TEMPLATE = 'opencode run --prompt-file "{promptFile}"';
const PREVIOUS_OPENCODE_COMMAND_TEMPLATE =
  'opencode run "Read and execute the attached prompt file exactly." -f "{promptFile}"';
const DEFAULT_OPENCODE_COMMAND_TEMPLATE =
  'opencode run --dangerously-skip-permissions "Read and execute the attached prompt file exactly." -f "{promptFile}"';

function normalizeAgentCommandTemplate(template: string) {
  const trimmed = template.trim();
  const normalized =
    trimmed === LEGACY_AGENT_COMMAND_TEMPLATE ||
    trimmed === PREVIOUS_OPENCODE_COMMAND_TEMPLATE ||
    /^opencode\s+run\s+--prompt-file\s+"?\{promptFile\}"?$/i.test(trimmed)
      ? DEFAULT_OPENCODE_COMMAND_TEMPLATE
      : trimmed;

  // inject --format json so sessionID can be parsed from stdout
  if (/\bopencode\s+run\b/i.test(normalized) && !/--format\s+json/.test(normalized)) {
    return normalized.replace(/\bopencode\s+run\b/i, "$& --format json");
  }
  return normalized;
}

function addContinueSessionFlag(command: string, continueSession: boolean) {
  if (!continueSession) return command;
  if (!/\bopencode\s+run\b/i.test(command)) return command;
  if (/(^|\s)(-c|--continue)(\s|$)/.test(command)) return command;

  return command.replace(/\bopencode\s+run\b/i, "$& -c");
}

function usage() {
  console.log(
    [
      "用法：",
      "  npx.cmd tsx prisma/tools/run-card-batch.ts <batch.json> [--run-opencode]",
      "  npx.cmd tsx prisma/tools/run-card-batch.ts <batch.json> --run-opencode --job 001 --prompt <prompt.md>",
      "",
      "说明：",
      "  不加 --run-opencode 时，只汇总已有 job/cards.json。",
      "  加 --run-opencode 时，每个任务按 01/02/03 三轮 prompt 顺序运行。",
      "  加 --job/--prompt 时，只给某个任务追加一轮 prompt。",
    ].join("\n")
  );
}

function resolveManifestPath(input: string) {
  return path.isAbsolute(input) ? input : path.join(process.cwd(), input);
}

function resolveInputPath(input: string) {
  return path.isAbsolute(input) ? input : path.join(process.cwd(), input);
}

function pathForCommand(filePath: string, cwd: string) {
  const relativePath = path.relative(cwd, filePath);
  const staysWithinCwd =
    relativePath &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath);
  
  // 如果路径包含非 ASCII 字符（如中文），使用绝对路径
  // 因为 opencode 在 Windows 上无法正确解析包含中文字符的路径
  const hasNonAscii = /[^\x00-\x7F]/.test(filePath);
  const value = staysWithinCwd && !hasNonAscii ? relativePath : filePath;

  return value.replace(/\\/g, "/");
}

function replaceTemplate(
  template: string,
  manifest: CardBatchManifest,
  job: CardBatchJob,
  promptFile: string,
  commandCwd: string,
  continueSession: boolean,
  sessionId?: string
) {
  const command = normalizeAgentCommandTemplate(template)
    .replaceAll("{promptFile}", pathForCommand(promptFile, commandCwd))
    .replaceAll("{promptFileAbsolute}", promptFile)
    .replaceAll("{promptFileName}", path.basename(promptFile))
    .replaceAll("{jobDir}", job.directory)
    .replaceAll("{batchDir}", manifest.rootDirectory)
    .replaceAll("{url}", job.source.url);

  // 如果有 sessionId，使用 --session 参数显式指定
  if (sessionId && continueSession) {
    return command.replace(/\bopencode\s+run\b/i, `$& --session ${sessionId}`);
  }
  // 如果没有 sessionId 但需要继续 session，使用 -c 参数
  // 注意：这可能会失败，如果上一个 session 不存在
  if (continueSession && !sessionId) {
    return addContinueSessionFlag(command, true);
  }
  return command;
}

async function readManifest(manifestPath: string) {
  const raw = await readFile(manifestPath, "utf8");
  return JSON.parse(raw) as CardBatchManifest;
}

async function writeManifest(manifestPath: string, manifest: CardBatchManifest) {
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
}

async function runShellCommand(
  command: string,
  cwd: string,
  logPaths?: { stdoutPath: string; stderrPath: string }
) {
  return new Promise<{ code: number | null; stdout: string; stderr: string; sessionId?: string }>((resolve) => {
    const isWindows = process.platform === "win32";
    
    let child: ReturnType<typeof spawn>;
    
    if (isWindows) {
      // 在 Windows 上，将命令写入临时 .ps1 文件，再用 powershell -File 执行
      // 这样可以避免 spawn 参数中中文字符编码问题
      const tempDir = path.join(os.tmpdir(), "opencode-batch");
      const tempScript = path.join(tempDir, `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`);
      
      // 同步创建目录和文件（在 Promise 构造器内）
      try {
        require("fs").mkdirSync(tempDir, { recursive: true });
        // 使用 UTF-8 with BOM 写入，确保 PowerShell 正确识别中文字符
        const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
        const content = Buffer.from(command, "utf8");
        require("fs").writeFileSync(tempScript, Buffer.concat([bom, content]));
      } catch {
        // 如果临时文件写入失败，回退到直接 spawn
        child = spawn("cmd.exe", ["/c", command], { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        setupChildHandlers(child, resolve, logPaths);
        return;
      }
      
      child = spawn("powershell.exe", [
        "-ExecutionPolicy", "Bypass",
        "-File", tempScript,
      ], { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      
      // 清理临时文件
      child.on("close", () => {
        try { require("fs").unlinkSync(tempScript); } catch { /* ignore */ }
      });
    } else {
      child = spawn(command, { cwd, shell: true, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    }
    
    setupChildHandlers(child, resolve, logPaths);
  });
}

function setupChildHandlers(
  child: ReturnType<typeof spawn>,
  resolve: (value: { code: number | null; stdout: string; stderr: string; sessionId?: string }) => void,
  logPaths?: { stdoutPath: string; stderrPath: string }
) {

  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  let sessionId: string | undefined;
  const stdoutStream = logPaths
    ? createWriteStream(logPaths.stdoutPath, { flags: "w" })
    : null;
  const stderrStream = logPaths
    ? createWriteStream(logPaths.stderrPath, { flags: "w" })
    : null;

  child.stdout?.on("data", (chunk) => {
    stdout.push(Buffer.from(chunk));
    stdoutStream?.write(chunk);
    
    // 解析 JSON 输出中的 sessionID
    const text = chunk.toString("utf8");
    for (const line of text.split("\n")) {
      try {
        const trimmed = line.trim();
        if (trimmed.startsWith("{")) {
          const json = JSON.parse(trimmed);
          if (json.sessionID && typeof json.sessionID === "string") {
            sessionId = json.sessionID;
          }
        }
      } catch {
        // 忽略非 JSON 行
      }
    }
  });
  child.stderr?.on("data", (chunk) => {
    stderr.push(Buffer.from(chunk));
    stderrStream?.write(chunk);
  });

  child.on("close", (code) => {
    stdoutStream?.end();
    stderrStream?.end();
    resolve({
      code,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
      sessionId,
    });
  });
}

async function runJob(
  manifestPath: string,
  manifest: CardBatchManifest,
  job: CardBatchJob,
  promptFile = job.promptSequencePath,
  options: { expectCards?: boolean; continueSession?: boolean; sessionId?: string } = {}
): Promise<string | undefined> {
  const expectCards = options.expectCards ?? true;
  const continueSession = options.continueSession ?? false;
  const commandCwd = process.cwd();
  const command = replaceTemplate(
    manifest.agentCommandTemplate,
    manifest,
    job,
    promptFile,
    commandCwd,
    continueSession,
    options.sessionId
  );
  job.status = "RUNNING";
  await writeManifest(manifestPath, manifest);

  await mkdir(job.directory, { recursive: true });
  await writeFile(path.join(job.directory, "agent-command.txt"), `${command}\n`, "utf8");

  const transcriptName =
    promptFile === job.promptSequencePath
      ? "transcript.md"
      : `transcript-${path.basename(promptFile, path.extname(promptFile))}.md`;
  const errorName =
    promptFile === job.promptSequencePath
      ? "agent.err.log"
      : `agent-${path.basename(promptFile, path.extname(promptFile))}.err.log`;
  const transcriptPath = path.join(job.directory, transcriptName);
  const errorPath = path.join(job.directory, errorName);

  const result = await runShellCommand(command, commandCwd, {
    stdoutPath: transcriptPath,
    stderrPath: errorPath,
  });

  await writeFile(transcriptPath, result.stdout || "", "utf8");
  await writeFile(errorPath, result.stderr || "", "utf8");

  const cardsPath = path.join(job.directory, "cards.json");
  const hasCards = existsSync(cardsPath);
  job.status =
    result.code === 0 && (!expectCards || hasCards)
      ? expectCards
        ? "EXPORTED"
        : "RUNNING"
      : "FAILED";
  await writeManifest(manifestPath, manifest);

  if (result.code !== 0 || (expectCards && !hasCards)) {
    const stderrTail = result.stderr.trim().split(/\r?\n/).slice(-30).join("\n");
    throw new Error(
      [
        `任务 ${job.id} 阶段 ${path.basename(promptFile)} 执行失败`,
        `命令：${command}`,
        `退出码：${result.code ?? "unknown"}`,
        expectCards && !hasCards ? "未生成 cards.json" : null,
        stderrTail ? `stderr：\n${stderrTail}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  return result.sessionId;
}

async function runJobStages(
  manifestPath: string,
  manifest: CardBatchManifest,
  job: CardBatchJob
) {
  const stagePrompts = job.stagePromptPaths?.length
    ? job.stagePromptPaths
    : [job.promptSequencePath];

  let sessionId: string | undefined;
  for (let index = 0; index < stagePrompts.length; index += 1) {
    const promptPath = stagePrompts[index];
    try {
      const isLastStage = index === stagePrompts.length - 1;
      sessionId = await runJob(manifestPath, manifest, job, promptPath, {
        expectCards: isLastStage,
        continueSession: index > 0,
        sessionId: index > 0 ? sessionId : undefined,
      });
    } catch (error) {
      // 如果某个阶段失败，记录错误并停止后续阶段
      console.error(`任务 ${job.id} 阶段 ${index + 1} 失败，停止后续阶段`);
      throw error;
    }
  }
}

async function callGptReview(params: {
  manifest: CardBatchManifest;
  job: CardBatchJob;
  cards: ExportedCard[];
}) {
  const settings = await readGptSettings();
  if (!settings.apiKey?.trim()) throw new Error("缺少 GPT API Key");
  if (!settings.apiUrl?.trim()) throw new Error("缺少 GPT API URL");
  if (!settings.model?.trim()) throw new Error("缺少 GPT 模型名");

  const reviewPrompt = params.manifest.gptReviewPrompt || settings.reviewPrompt;
  const response = await fetch(settings.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "你是以南京大学新生用户视角审查知识卡片的审稿人。只根据给出的卡片和来源字段提出问题，不要编造事实。",
        },
        {
          role: "user",
          content: [
            reviewPrompt,
            "",
            `来源 URL：${params.job.source.url}`,
            "",
            "第一版 cards.json：",
            JSON.stringify(params.cards, null, 2),
            "",
            "请输出两部分：",
            "1. 用户视角审查意见：逐张指出是否能解决问题，以及哪里需要改。",
            "2. 可直接追加给 opencode 的二轮迭代 Prompt：要求它覆盖重写 cards.json、cards.md、iteration.md。",
          ].join("\n"),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`GPT 审查失败：${response.status} ${await response.text()}`);
  }

  const raw = await response.text();
  let data: {
    choices?: Array<{
      message?: { content?: string };
      text?: string;
    }>;
  };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      `GPT API 返回的不是 JSON。请检查 API URL 是否是 chat completions 接口，例如 /v1/chat/completions。返回开头：${raw.slice(
        0,
        120
      )}`
    );
  }
  const content =
    data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("GPT 审查结果为空");
  }

  return content.trim();
}

async function runGptReviewIteration(
  manifestPath: string,
  manifest: CardBatchManifest,
  job: CardBatchJob
) {
  const { cards, error } = await readCards(job);
  if (error) throw new Error(error);

  const review = await callGptReview({ manifest, job, cards });
  await writeFile(path.join(job.directory, "gpt-review.md"), `${review}\n`, "utf8");

  const followupsDirectory = path.join(job.directory, "followups");
  await mkdir(followupsDirectory, { recursive: true });
  const promptPath = path.join(followupsDirectory, "gpt-review-iteration.md");
  const prompt = [
    "# GPT 用户视角审查后的二轮迭代",
    "",
    "下面是 GPT 以用户视角做出的审查意见。请接着当前任务继续处理，修正卡片并覆盖输出 cards.json、cards.md、iteration.md。iteration.md 需要记录本轮发现的问题、修正点、以及可沉淀到工作流的规则。",
    "",
    "**重要规则：**",
    "1. 如果本轮 cards.json 为空数组，说明上一轮未成功抓取源内容。你必须重新用 fetch-content.ts 抓取来源 URL，获取实际内容后再制卡。禁止凭空编造卡片——如果源内容确实无法获取，保持 cards.json 为空数组并在 iteration.md 说明原因。",
    "2. cards.json 必须严格遵循以下格式，字段名不能自创：",
    "   - summary（必填）：问题形状摘要，不超过 200 字",
    "   - body（必填）：正文，仅文字",
    "   - sourceExcerpt：逐字原文片段",
    "   - sourceUrl：主来源 URL",
    "   - sourceDescription：带年份/版本的来源说明",
    "   - sourceType：OFFICIAL | DOCUMENT | SENIOR | AUTHOR_EXPERIENCE | OTHER",
    "   - domainTag：选课规则 | 校园服务 | 院系结构 | 保研转专业 | 竞赛科研 | 生活指南 | 其他",
    "   - verificationStatus：NEEDS_REVIEW",
    "   禁止使用 title/content/answer/steps 等自创字段名。",
    "",
    "## GPT 审查意见",
    "",
    review,
    "",
  ].join("\n");

  await writeFile(promptPath, prompt, "utf8");
  await runJob(manifestPath, manifest, job, promptPath);
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) await worker(item);
    }
  });

  await Promise.all(workers);
}

function requireString(card: ExportedCard, key: keyof ExportedCard, issues: string[]) {
  const value = card[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${String(key)} 不能为空`);
  }
}

function validateCard(card: ExportedCard, index: number) {
  const issues: string[] = [];

  requireString(card, "summary", issues);
  requireString(card, "body", issues);
  requireString(card, "sourceExcerpt", issues);
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

  return {
    index,
    ok: issues.length === 0,
    issues,
  };
}

function fixUnescapedQuotes(json: string): string {
  let result = "";
  let inString = false;
  let i = 0;
  while (i < json.length) {
    const ch = json[i];
    if (ch === "\\" && inString) {
      result += ch;
      if (i + 1 < json.length) { result += json[i + 1]; i += 2; } else { i++; }
      continue;
    }
    if (ch === '"') {
      if (!inString) { inString = true; result += ch; i++; continue; }
      let j = i + 1;
      while (j < json.length && (json[j] === " " || json[j] === "\t" || json[j] === "\r" || json[j] === "\n")) j++;
      const next = json[j];
      if (next === "," || next === "}" || next === "]" || next === ":") {
        inString = false;
        result += ch;
      } else {
        result += '\\"';
      }
      i++;
      continue;
    }
    result += ch;
    i++;
  }
  return result;
}

async function readCards(job: CardBatchJob) {
  const cardsPath = path.join(job.directory, "cards.json");
  if (!existsSync(cardsPath)) {
    return { cards: [] as ExportedCard[], error: "缺少 cards.json" };
  }

  let raw = await readFile(cardsPath, "utf8");

  // 先尝试直接解析
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { cards: [] as ExportedCard[], error: "cards.json 必须是数组" };
    }
    return { cards: parsed as ExportedCard[], error: null };
  } catch {
    // 尝试修复未转义引号
    try {
      const fixed = fixUnescapedQuotes(raw);
      const parsed = JSON.parse(fixed);
      if (!Array.isArray(parsed)) {
        return { cards: [] as ExportedCard[], error: "cards.json 必须是数组" };
      }
      // 修复成功，写回文件
      await writeFile(cardsPath, fixed, "utf8");
      console.log(`  cards.json 已自动修复（未转义引号）`);
      return { cards: parsed as ExportedCard[], error: null };
    } catch {
      return {
        cards: [] as ExportedCard[],
        error: "cards.json 解析失败（自动修复也未能解决）",
      };
    }
  }
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

async function aggregate(manifestPath: string, manifest: CardBatchManifest) {
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
    const { cards, error } = await readCards(job);
    const hasIteration = existsSync(path.join(job.directory, "iteration.md"));
    const validation = cards.map((card, index) => validateCard(card, index + 1));
    const issueText = [
      error,
      hasIteration ? null : "缺少 iteration.md",
      ...validation.flatMap((item) =>
        item.issues.map((issue) => `卡片 ${item.index}: ${issue}`)
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
      JSON.stringify({ ok: !issueText, issues: issueText ? issueText.split("；") : [] }, null, 2),
      "utf8"
    );

    reportLines.push(
      `| ${job.id} | ${job.status} | ${cards.length} | ${issueText ? "需处理" : "通过"} | ${issueText || "-"} |`
    );
  }

  await writeFile(
    path.join(exportsDirectory, "all-cards.json"),
    JSON.stringify(allCards, null, 2),
    "utf8"
  );
  await writeFile(
    path.join(exportsDirectory, "all-cards.md"),
    ["# 批量卡片导出", "", ...allCards.map(cardToMarkdown)].join("\n"),
    "utf8"
  );
  await writeFile(
    path.join(exportsDirectory, "review-report.md"),
    `${reportLines.join("\n")}\n`,
    "utf8"
  );
  await writeManifest(manifestPath, manifest);

  console.log(`已汇总 ${allCards.length} 张卡片`);
  console.log(path.join(exportsDirectory, "review-report.md"));
}

async function main() {
  const args = process.argv.slice(2);
  const manifestArg = args.find((arg) => !arg.startsWith("--"));
  const runOpencode = args.includes("--run-opencode");
  const jobIndex = args.indexOf("--job");
  const promptIndex = args.indexOf("--prompt");
  const selectedJobId = jobIndex > -1 ? args[jobIndex + 1] : undefined;
  const selectedPrompt = promptIndex > -1 ? args[promptIndex + 1] : undefined;

  if (!manifestArg || args.includes("--help")) {
    usage();
    return;
  }

  const manifestPath = resolveManifestPath(manifestArg);
  const manifest = await readManifest(manifestPath);
  const selectedJobs = selectedJobId
    ? manifest.jobs.filter((job) => job.id === selectedJobId)
    : manifest.jobs;

  if (selectedJobId && selectedJobs.length === 0) {
    throw new Error(`找不到任务：${selectedJobId}`);
  }

  if (runOpencode) {
    if (selectedPrompt) {
      if (!selectedJobId) throw new Error("--prompt 必须和 --job 一起使用");
      await runJob(
        manifestPath,
        manifest,
        selectedJobs[0],
        resolveInputPath(selectedPrompt)
      );
    } else {
      const opencodeConcurrency = Math.max(1, manifest.concurrency);

      await runWithConcurrency(
        selectedJobs,
        opencodeConcurrency,
        async (job) => runJobStages(manifestPath, manifest, job)
      );

      if (manifest.gptReviewEnabled) {
        await runWithConcurrency(
          selectedJobs,
          Math.max(1, manifest.concurrency),
          async (job) => runGptReviewIteration(manifestPath, manifest, job)
        );
      }
    }
  }

  await aggregate(manifestPath, manifest);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
