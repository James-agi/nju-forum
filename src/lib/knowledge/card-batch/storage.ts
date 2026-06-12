import "server-only";

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  CARD_BATCH_PHASE_LABELS,
  CARD_BATCH_PHASES,
  type CardBatchCreateRequest,
  type CardBatchJob,
  type CardBatchManifest,
  type CardBatchPhase,
  type CardBatchPromptHook,
  type CardBatchSourceInput,
} from "./types";
import {
  CARD_BATCH_PHASE_ORDER,
  DEFAULT_AGENT_COMMAND_TEMPLATE,
  cloneDefaultHooks,
} from "./defaults";

const workflowRoot = path.join(process.cwd(), "agent-workflows", "card-batch");
const runsRoot = path.join(workflowRoot, "runs");

const hookSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1).max(120),
  phase: z.enum(CARD_BATCH_PHASES),
  enabled: z.boolean(),
  order: z.number().int().min(0).max(9999),
  content: z.string().trim().min(1).max(12000),
});

const createSchema = z.object({
  name: z.string().trim().max(120).optional(),
  urls: z.string().trim().min(1, "至少需要输入一个 URL"),
  concurrency: z.coerce.number().int().min(1).max(8).optional(),
  agentCommandTemplate: z.string().trim().max(500).optional(),
  gptReviewEnabled: z.boolean().optional(),
  gptReviewPrompt: z.string().trim().max(12000).optional(),
  hooks: z.array(hookSchema).optional(),
});

export function getRunsRoot() {
  return runsRoot;
}

function ensureSafeBatchId(batchId: string) {
  if (
    !batchId.trim() ||
    batchId.includes("..") ||
    /[\\/<>:"|?*\x00-\x1F]/.test(batchId)
  ) {
    throw new Error("批次 ID 无效");
  }

  return batchId;
}

function getManifestPath(batchId: string) {
  return path.join(runsRoot, ensureSafeBatchId(batchId), "batch.json");
}

function padJobId(index: number) {
  return String(index + 1).padStart(3, "0");
}

function sanitizeSegment(value: string, fallback: string) {
  // 只删除 Windows 文件名非法字符和控制字符，保留中文等 Unicode
  const safe = value
    .replace(/[\x00-\x1F]/g, "")
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return safe || fallback;
}

function sourceTitleFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const lastPath = parsed.pathname
      .split("/")
      .map((part) => decodeURIComponent(part.trim()))
      .filter(Boolean)
      .at(-1);

    return lastPath || parsed.hostname;
  } catch {
    return "unknown-source";
  }
}

function parseSourceLine(line: string): CardBatchSourceInput {
  const pipeIndex = line.indexOf("|");
  if (pipeIndex > -1) {
    const title = line.slice(0, pipeIndex).trim();
    const url = line.slice(pipeIndex + 1).trim();
    return { title: title || undefined, url };
  }

  return { url: line.trim() };
}

function parseSources(urls: string) {
  const sources = urls
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseSourceLine);

  const invalid = sources.filter((source) => {
    try {
      const parsed = new URL(source.url);
      return !["http:", "https:"].includes(parsed.protocol);
    } catch {
      return true;
    }
  });

  if (invalid.length > 0) {
    throw new Error(`URL 无效：${invalid.map((source) => source.url).join("，")}`);
  }

  return sources;
}

function sortHooks(hooks: CardBatchPromptHook[]) {
  return [...hooks].sort((a, b) => {
    const phaseDelta =
      CARD_BATCH_PHASE_ORDER.indexOf(a.phase) - CARD_BATCH_PHASE_ORDER.indexOf(b.phase);
    if (phaseDelta !== 0) return phaseDelta;
    return a.order - b.order;
  });
}

function enabledHooksForPhase(hooks: CardBatchPromptHook[], phase: CardBatchPhase) {
  return sortHooks(hooks).filter((hook) => hook.enabled && hook.phase === phase);
}

export function buildOutputContract() {
  return [
    "## 输出文件协议",
    "",
    "在任务目录写出以下文件：",
    "",
    "```text",
    "cards.json",
    "cards.md",
    "iteration.md",
    "```",
    "",
    "cards.json 必须是数组，每张卡格式如下：",
    "",
    "```json",
    "[",
    "  {",
    '    "action": "create | merge",',
    '    "mergeWithSummary": "仅 merge 时填写，已有卡片的 summary（用于入库时定位目标卡片）",',
    '    "summary": "问题形状摘要，不超过 200 字",',
    '    "body": "正文，仅文字。body 中绝对不能出现 ![]( 图片 Markdown，所有图片一律放 sourceExcerpt",',
    '    "sourceExcerpt": "逐字原文片段、超链接和本地图片 Markdown 引用",',
    '    "sourceUrl": "主来源 URL",',
    '    "sourceUrls": ["URL1", "URL2"],',
    '    "sourceDescription": "带年份/版本的来源说明",',
    '    "sourceType": "OFFICIAL | DOCUMENT | SENIOR | AUTHOR_EXPERIENCE | OTHER",',
    '    "domainTag": "选课规则 | 校园服务 | 院系结构 | 保研转专业 | 竞赛科研 | 生活指南 | 其他",',
    '    "verificationStatus": "NEEDS_REVIEW"',
    "  }",
    "]",
    "```",
  ];
}

export function buildStagePrompt(params: {
  manifestId: string;
  job: CardBatchJob;
  hooks: CardBatchPromptHook[];
  phase: CardBatchPhase;
}) {
  const phaseHooks = enabledHooksForPhase(params.hooks, params.phase);
  const lines: string[] = [
    `# ${CARD_BATCH_PHASE_LABELS[params.phase]}`,
    "",
    `批次：${params.manifestId}`,
    `任务：${params.job.id}`,
    `任务目录：${params.job.directory}`,
    "",
    "- 工作目录是项目根目录 D:\\nju-forum。",
    "- 不要直接写数据库，不要把卡片标为 VERIFIED。",
    "- 所有导出的卡片 verificationStatus 一律为 NEEDS_REVIEW。",
  ];

  if (params.phase === "submit_url") {
    lines.push(
      "",
      "**批处理模式：不要停下来向用户提问。若判断来源已被现有卡充分覆盖，直接创建空 cards.json（内容为 []）并在 iteration.md 说明跳过原因，然后结束任务。**",
      "",
      "## 本轮来源",
      "",
      `来源 URL：${params.job.source.url}`,
      `来源标题：${params.job.source.title || "未提供，需从网页主题判断"}`,
      "",
      ...buildOutputContract(),
      "",
      "## 查库与合并决策",
      "",
      "在生成卡片前，你必须：",
      "1. 用 Prisma 查询数据库中同 domainTag 的已有卡片（summary + body + sourceUrl + sourceUrls）",
      "2. 对每张待生成的卡片，逐条比对已有卡片的 body：",
      "   - 若正文高度重叠 → action: \"merge\"，以已有卡片 body 为基础重写合并版",
      "   - 若无重叠 → action: \"create\"",
      "3. 合并时：mergeWithSummary 填已有卡片的 summary；sourceUrls 填所有相关 URL",
      "4. iteration.md 记录每张卡的合并/新建决策理由",
      "",
      "查库脚本：",
      "```typescript",
      "import { PrismaClient } from \"@prisma/client\";",
      "const prisma = new PrismaClient();",
      "const cards = await prisma.knowledgeCard.findMany({",
      "  where: { archivedAt: null, domainTag: \"<你判断的domainTag>\" },",
      "  select: { summary: true, body: true, sourceUrl: true, sourceUrls: true },",
      "});",
      "for (const c of cards) console.log(JSON.stringify(c));",
      "await prisma.$disconnect();",
      "```"
    );
  }

  if (params.phase === "compare_source") {
    lines.push("", ...buildOutputContract());
  }

  for (const hook of phaseHooks) {
    lines.push("", `## ${hook.title}`, "", hook.content);
  }

  if (params.phase === "compare_source") {
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
      "- 每张卡的 body 中是否都不包含 ![]( 图片 Markdown？（所有图片必须放 sourceExcerpt）"
    );
  }

  return `${lines.join("\n")}\n`;
}

function buildReviewReport(manifest: CardBatchManifest) {
  const lines = [
    "# 批量制卡审核报告",
    "",
    `批次：${manifest.name}`,
    `创建时间：${manifest.createdAt}`,
    `任务数：${manifest.jobs.length}`,
    "",
    "## 任务清单",
    "",
    "| # | 状态 | 来源 | 目录 |",
    "|---|---|---|---|",
    ...manifest.jobs.map(
      (job) =>
        `| ${job.id} | ${job.status} | ${job.source.title || job.source.url} | ${job.directory} |`
    ),
    "",
    "## 后续动作",
    "",
    "1. 用 runner 执行 opencode 子任务。",
    "2. 检查每个任务目录的 cards.json、cards.md、iteration.md。",
    "3. 运行汇总导出后，再人工审核卡片。",
  ];

  return `${lines.join("\n")}\n`;
}

export async function createCardBatch(input: CardBatchCreateRequest) {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join("；"));
  }

  const sources = parseSources(parsed.data.urls);
  const createdAt = new Date().toISOString();
  const stamp = createdAt
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "")
    .replace("T", "-");
  const name = parsed.data.name?.trim() || `card-batch-${stamp}`;
  const batchId = `card-batch-${stamp}`;
  const rootDirectory = path.join(runsRoot, batchId);
  const jobsDirectory = path.join(rootDirectory, "jobs");
  const exportsDirectory = path.join(rootDirectory, "exports");
  const hooks = parsed.data.hooks?.length ? parsed.data.hooks : cloneDefaultHooks();

  await mkdir(jobsDirectory, { recursive: true });
  await mkdir(exportsDirectory, { recursive: true });

  const jobs: CardBatchJob[] = sources.map((source, index) => {
    const jobId = padJobId(index);
    const title = source.title || sourceTitleFromUrl(source.url);
    const slug = `${jobId}-${sanitizeSegment(title, `source-${jobId}`)}`;
    const directory = path.join(jobsDirectory, slug);

    return {
      id: jobId,
      source: { ...source, title },
      slug,
      directory,
      promptSequencePath: path.join(directory, "01-read-prompt.md"),
      stagePromptPaths: [
        path.join(directory, "01-read-prompt.md"),
        path.join(directory, "02-submit-url.md"),
        path.join(directory, "03-compare-source.md"),
      ],
      status: "SCAFFOLDED",
    };
  });

  const manifest: CardBatchManifest = {
    id: batchId,
    name,
    createdAt,
    rootDirectory,
    concurrency: parsed.data.concurrency ?? 2,
    agentCommandTemplate:
      parsed.data.agentCommandTemplate?.trim() || DEFAULT_AGENT_COMMAND_TEMPLATE,
    gptReviewEnabled: parsed.data.gptReviewEnabled ?? false,
    gptReviewPrompt: parsed.data.gptReviewPrompt?.trim() || "",
    hooks,
    jobs,
  };

  for (const job of jobs) {
    await mkdir(job.directory, { recursive: true });
    await writeFile(
      path.join(job.directory, "input.json"),
      JSON.stringify({ batchId, jobId: job.id, source: job.source }, null, 2),
      "utf8"
    );
    await writeFile(
      job.stagePromptPaths[0],
      buildStagePrompt({
        manifestId: batchId,
        job,
        hooks,
        phase: "read_prompt_file",
      }),
      "utf8"
    );
    await writeFile(
      job.stagePromptPaths[1],
      buildStagePrompt({
        manifestId: batchId,
        job,
        hooks,
        phase: "submit_url",
      }),
      "utf8"
    );
    await writeFile(
      job.stagePromptPaths[2],
      buildStagePrompt({
        manifestId: batchId,
        job,
        hooks,
        phase: "compare_source",
      }),
      "utf8"
    );
  }

  await writeFile(
    path.join(rootDirectory, "batch.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );
  await writeFile(
    path.join(exportsDirectory, "review-report.md"),
    buildReviewReport(manifest),
    "utf8"
  );
  await writeFile(path.join(exportsDirectory, "all-cards.json"), "[]\n", "utf8");
  await writeFile(
    path.join(exportsDirectory, "all-cards.md"),
    "# 批量卡片导出\n\n等待 runner 汇总。\n",
    "utf8"
  );

  return manifest;
}

export async function listCardBatches() {
  try {
    const entries = await readdir(runsRoot, { withFileTypes: true });
    const results = await Promise.allSettled(
      entries
        .filter((entry) => entry.isDirectory())
        .slice(-20)
        .map(async (entry) => {
          const manifestPath = path.join(runsRoot, entry.name, "batch.json");
          const raw = await readFile(manifestPath, "utf8");
          return JSON.parse(raw) as CardBatchManifest;
        })
    );

    const batches: CardBatchManifest[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        batches.push(result.value);
      }
    }
    return batches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function readCardBatch(batchId: string) {
  const raw = await readFile(getManifestPath(batchId), "utf8");
  return JSON.parse(raw) as CardBatchManifest;
}

export function buildRunnerCommand(manifest: CardBatchManifest) {
  const manifestPath = path
    .relative(process.cwd(), path.join(manifest.rootDirectory, "batch.json"))
    .replace(/\\/g, "/");

  return `npx.cmd tsx prisma/tools/run-card-batch.ts ${manifestPath} --run-opencode`;
}

export async function createJobFollowup(params: {
  batchId: string;
  jobId: string;
  prompt: string;
}) {
  const manifest = await readCardBatch(params.batchId);
  const job = manifest.jobs.find((item) => item.id === params.jobId);
  if (!job) throw new Error("找不到对应任务");

  const prompt = params.prompt.trim();
  if (!prompt) throw new Error("追加 Prompt 不能为空");

  const followupsDirectory = path.join(job.directory, "followups");
  await mkdir(followupsDirectory, { recursive: true });

  const existing = await readdir(followupsDirectory).catch(() => []);
  const index = String(existing.length + 1).padStart(3, "0");
  const promptPath = path.join(followupsDirectory, `${index}-user-prompt.md`);
  const content = [
    "# 继续对话 Prompt",
    "",
    "请接着当前任务上下文继续处理，不要切换来源，不要直接入库。若发现卡片或流程问题，请同步更新 iteration.md。",
    "",
    prompt,
    "",
  ].join("\n");

  await writeFile(promptPath, content, "utf8");

  const manifestPath = path
    .relative(process.cwd(), path.join(manifest.rootDirectory, "batch.json"))
    .replace(/\\/g, "/");
  const relativePromptPath = path.relative(process.cwd(), promptPath).replace(/\\/g, "/");

  return {
    batchId: manifest.id,
    jobId: job.id,
    promptPath,
    runnerCommand: `npx.cmd tsx prisma/tools/run-card-batch.ts ${manifestPath} --run-opencode --job ${job.id} --prompt ${relativePromptPath}`,
  };
}
