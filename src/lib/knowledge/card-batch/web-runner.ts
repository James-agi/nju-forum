import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { readCardBatch } from "./storage";

// Note: buildStagePrompt 和 OUTPUT_CONTRACT 在 storage.ts 中也有副本，
// 修改时需要两边同步。TODO: 统一到 storage.ts 导出。
import { aggregateBatch, readJobCards, validateCard } from "./aggregation";
import { readOpencodePort, readGptSettings } from "./settings";
import {
  ensureServer,
  createSession,
  sendMessage,
} from "./opencode-server";
import type { CardBatchJob, CardBatchManifest, CardBatchPromptHook } from "./types";
import {
  CARD_BATCH_PHASE_LABELS,
  type CardBatchPhase,
} from "./types";
import { cloneDefaultHooks, CARD_BATCH_PHASE_ORDER } from "./defaults";
import { repairCardsJson } from "./json-repair";

type WebRunStatus = {
  batchId: string;
  status: "IDLE" | "RUNNING" | "DONE" | "FAILED";
  startedAt?: string;
  endedAt?: string;
  error?: string;
};

const running = new Map<string, AbortController>();
const runningFollowups = new Map<string, AbortController>();
const runningIterations = new Map<string, AbortController>();

// ── status helpers ──

function statusPath(rootDirectory: string) {
  return path.join(rootDirectory, "web-run-status.json");
}

async function writeStatus(rootDirectory: string, status: WebRunStatus) {
  await writeFile(statusPath(rootDirectory), JSON.stringify(status, null, 2), "utf8");
}

/** Atomic write: writes to a temp file first, then renames to target. */
async function atomicWriteFile(filePath: string, data: string, encoding: BufferEncoding = "utf8") {
  const tmpPath = filePath + ".tmp-" + Math.random().toString(36).slice(2, 8);
  await writeFile(tmpPath, data, encoding);
  await rename(tmpPath, filePath);
}

export async function readWebRunStatus(batchId: string): Promise<WebRunStatus> {
  const batch = await readCardBatch(batchId);
  const file = statusPath(batch.rootDirectory);
  if (!existsSync(file)) return { batchId, status: "IDLE" };
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as WebRunStatus;
}

// ── prompt building ──

function enabledHooksForPhase(hooks: CardBatchPromptHook[], phase: CardBatchPhase) {
  return [...hooks]
    .sort((a, b) => {
      const da =
        CARD_BATCH_PHASE_ORDER.indexOf(a.phase) - CARD_BATCH_PHASE_ORDER.indexOf(b.phase);
      if (da !== 0) return da;
      return a.order - b.order;
    })
    .filter((h) => h.enabled && h.phase === phase);
}

const OUTPUT_CONTRACT = [
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

function buildStagePrompt(params: {
  manifestId: string;
  job: CardBatchJob;
  hooks: CardBatchPromptHook[];
  phase: CardBatchPhase;
}): string {
  const phaseHooks = enabledHooksForPhase(params.hooks, params.phase);
  const lines = [
    `# ${CARD_BATCH_PHASE_LABELS[params.phase]}`,
    "",
    `批次：${params.manifestId}`,
    `任务：${params.job.id}`,
    `任务目录：${params.job.directory}`,
    "",
    "- 工作目录是项目根目录 D:\\nju-forum。",
    "- 不要直接写数据库，不要把卡片标为 VERIFIED。",
    "- 所有导出的卡片 verificationStatus 一律为 NEEDS_REVIEW。",
    "",
    "**批处理模式：你是无人值守的批处理 agent，不要停下来向用户提问，不要等待确认。" +
    "所有决定自己做出，遇到冲突选最保守方案。" +
    "若判断来源已被现有卡充分覆盖，直接创建空 cards.json（内容为 []）并在 iteration.md 说明跳过原因，然后结束任务。**",
  ];

  if (params.phase === "submit_url") {
    lines.push(
      "",
      "## 本轮来源",
      "",
      `来源 URL：${params.job.source.url}`,
      `来源标题：${params.job.source.title || "未提供，需从网页主题判断"}`,
      "",
      ...OUTPUT_CONTRACT,
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
      "```",
    );
  }

  if (params.phase === "compare_source") {
    lines.push("", ...OUTPUT_CONTRACT);
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
      "- 每张卡的 body 中是否都不包含 ![]( 图片 Markdown？（所有图片必须放 sourceExcerpt）",
    );
  }

  return lines.join("\n") + "\n";
}

function buildFollowupPrompt(followup: string): string {
  return [
    "# 继续对话 Prompt",
    "",
    "请接着当前任务上下文继续处理，不要切换来源，不要直接入库。",
    "若发现卡片或流程问题，请同步更新 iteration.md。",
    "",
    followup,
    "",
  ].join("\n");
}

// ── GPT review ──

async function callGptReview(params: {
  manifest: CardBatchManifest;
  job: CardBatchJob;
  cards: Record<string, unknown>[];
}): Promise<string> {
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
    choices?: Array<{ message?: { content?: string }; text?: string }>;
  };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      `GPT API 返回的不是 JSON。请检查 API URL 是否是 chat completions 接口。返回开头：${raw.slice(0, 120)}`,
    );
  }

  const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("GPT 审查结果为空");
  }

  return content.trim();
}

function validateCardsJsonFile(jobDir: string): { ok: boolean; error?: string } {
  const cardsPath = path.join(jobDir, "cards.json");
  if (!existsSync(cardsPath)) {
    return { ok: false, error: "cards.json 不存在" };
  }

  try {
    const raw = readFileSync(cardsPath, "utf8");
    const { repaired, fixed } = repairCardsJson(raw);

    if (fixed) {
      // Save repaired version
      writeFileSync(cardsPath, repaired, "utf8");
      // Also save broken original for debugging
      writeFileSync(path.join(jobDir, "cards.broken.json"), raw, "utf8");
      console.warn(`Job ${path.basename(jobDir)}: cards.json 已自动修复（未转义引号）`);
    }

    const parsed = JSON.parse(repaired);
    if (!Array.isArray(parsed)) {
      return { ok: false, error: "cards.json 必须是数组" };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "cards.json 解析失败" };
  }
}

async function runGptReviewViaApi(
  manifest: CardBatchManifest,
  job: CardBatchJob,
  sessionId: string,
): Promise<void> {
  const { cards, error } = await readJobCards(job);
  if (error) throw new Error(`无法读取 cards.json: ${error}`);
  if (cards.length === 0) {
    console.warn(`Job ${job.id}: 无卡片，跳过 GPT 审查`);
    return;
  }

  const review = await callGptReview({ manifest, job, cards });
  await writeFile(path.join(job.directory, "gpt-review.md"), review + "\n", "utf8");

  const reviewPrompt = [
    "# GPT 用户视角审查后的二轮迭代",
    "",
    "下面是 GPT 以用户视角做出的审查意见。请接着当前任务继续处理，",
    "修正卡片并覆盖输出 cards.json、cards.md、iteration.md。",
    "iteration.md 需要记录本轮发现的问题、修正点、以及可沉淀到工作流的规则。",
    "",
    "## 重要：JSON 格式要求",
    "",
    "cards.json 必须是合法 JSON。body 和 sourceExcerpt 字段中：",
    "- 中文引号请使用「」或 “”，不要使用 ASCII 双引号 \"",
    "- 如果必须使用 ASCII 双引号，务必写成 \\\"",
    "- 确保每行 JSON 语法正确，逗号不遗漏不多余",
    "- body 中绝对不能出现 ![]( 图片 Markdown，所有图片必须放 sourceExcerpt",
    "",
    "## GPT 审查意见",
    "",
    review,
    "",
  ].join("\n");

  // Backup pre-review cards.json
  const cardsJsonPath = path.join(job.directory, "cards.json");
  if (existsSync(cardsJsonPath)) {
    const preReview = await readFile(cardsJsonPath, "utf8");
    await writeFile(path.join(job.directory, "cards.pre-review.json"), preReview, "utf8");
  }

  const result = await sendMessage(sessionId, {
    agent: "build",
    parts: [{ type: "text", text: reviewPrompt }],
  });

  if (result.info.finish !== "stop" && result.info.finish !== "end_turn") {
    throw new Error(`GPT review iteration finished with unexpected status: ${result.info.finish}`);
  }

  // Validate cards.json after GPT iteration
  const validation = validateCardsJsonFile(job.directory);
  if (!validation.ok) {
    // Restore pre-review backup if available
    const preReviewPath = path.join(job.directory, "cards.pre-review.json");
    if (existsSync(preReviewPath)) {
      console.warn(
        `Job ${job.id}: GPT 迭代后 cards.json 损坏（${validation.error}），回退到审查前版本`,
      );
      const preReview = await readFile(preReviewPath, "utf8");
      await writeFile(cardsJsonPath, preReview, "utf8");
    } else {
      throw new Error(`GPT 迭代后 cards.json 损坏且无备份: ${validation.error}`);
    }
  }
}

// ── core runner ──

async function ensureOpendexServer(): Promise<number> {
  const configuredPort = await readOpencodePort();
  return ensureServer(configuredPort > 0 ? configuredPort : undefined);
}

async function writeTranscript(
  jobDir: string,
  stage: string,
  parts: Array<{ type: string; text?: string }>,
) {
  const transcriptPath = path.join(jobDir, `transcript-${stage}.md`);
  const content = parts
    .filter((p) => p.type === "text" || p.type === "reasoning")
    .map((p) => `[${p.type}]\n${p.text ?? ""}\n`)
    .join("\n");
  await writeFile(transcriptPath, content, "utf8");
}

async function runJobStagesViaApi(
  manifest: CardBatchManifest,
  job: CardBatchJob,
): Promise<{ sessionId: string }> {
  await mkdir(job.directory, { recursive: true });

  const hooks = manifest.hooks?.length ? manifest.hooks : cloneDefaultHooks();
  const phases: CardBatchPhase[] = ["read_prompt_file", "submit_url", "compare_source"];

  // Create session
  const session = await createSession({
    title: `batch-${manifest.id}-job-${job.id}`,
  });

  // Persist session ID so followups can reuse the same context
  await writeFile(
    path.join(job.directory, "session-id.txt"),
    session.id + "\n",
    "utf8",
  );

  for (const phase of phases) {
    const prompt = buildStagePrompt({
      manifestId: manifest.id,
      job,
      hooks,
      phase,
    });

    await writeFile(
      path.join(job.directory, `prompt-${phase}.md`),
      prompt,
      "utf8",
    );

    const result = await sendMessage(session.id, {
      agent: "build",
      parts: [{ type: "text", text: prompt }],
    });

    await writeTranscript(job.directory, phase, result.parts);

    if (result.info.finish !== "stop" && result.info.finish !== "end_turn") {
      throw new Error(
        `Stage ${phase} finished with unexpected status: ${result.info.finish}`,
      );
    }
  }

  return { sessionId: session.id };
}

async function runJob(
  manifestPath: string,
  manifest: CardBatchManifest,
  job: CardBatchJob,
) {
  try {
    job.status = "RUNNING";
    await atomicWriteFile(manifestPath, JSON.stringify(manifest, null, 2));

    const { sessionId } = await runJobStagesViaApi(manifest, job);

    // Check cards.json
    const cardsPath = path.join(job.directory, "cards.json");
    if (!existsSync(cardsPath)) {
      throw new Error(`OpenCode did not generate cards.json for job ${job.id}`);
    }

    // GPT review
    if (manifest.gptReviewEnabled) {
      await runGptReviewViaApi(manifest, job, sessionId);
    }

    job.status = "EXPORTED";
    await atomicWriteFile(manifestPath, JSON.stringify(manifest, null, 2));
  } catch (error) {
    job.status = "FAILED";
    // 清理旧 session，防止重试时复用已卡住的会话
    const sessionFilePath = path.join(job.directory, "session-id.txt");
    try {
      if (existsSync(sessionFilePath)) unlinkSync(sessionFilePath);
    } catch { /* ignore cleanup errors */ }
    await atomicWriteFile(manifestPath, JSON.stringify(manifest, null, 2));
    throw error;
  }
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) {
  if (items.length === 0) return;
  const queue = [...items];
  let firstError: unknown = null;
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      try {
        await worker(item);
      } catch (error) {
        // Keep going — one failed job shouldn't block the rest
        if (!firstError) firstError = error;
      }
    }
  });
  await Promise.all(workers);
  if (firstError) throw firstError;
}

async function buildFollowupContext(job: CardBatchJob): Promise<string> {
  const parts: string[] = [];
  const cardsPath = path.join(job.directory, "cards.json");
  const gptReviewPath = path.join(job.directory, "gpt-review.md");
  const iterationPath = path.join(job.directory, "iteration.md");

  if (existsSync(cardsPath)) {
    try {
      const rawCards = readFileSync(cardsPath, "utf8");
      const { repaired } = repairCardsJson(rawCards);
      const cards = JSON.parse(repaired);
      if (Array.isArray(cards) && cards.length > 0) {
        parts.push(
          "## 当前卡片",
          "",
          "```json",
          JSON.stringify(cards, null, 2),
          "```",
        );
      }
    } catch { /* skip broken cards */ }
  }

  if (existsSync(gptReviewPath)) {
    const gptReview = await readFile(gptReviewPath, "utf8");
    if (gptReview.trim()) {
      parts.push("## GPT 审查意见", "", gptReview);
    }
  }

  if (existsSync(iterationPath)) {
    const iteration = await readFile(iterationPath, "utf8");
    if (iteration.trim()) {
      parts.push("## 迭代记录", "", iteration);
    }
  }

  return parts.length > 0 ? parts.join("\n\n") + "\n" : "";
}

async function runFollowupViaApi(
  manifest: CardBatchManifest,
  job: CardBatchJob,
  promptContent: string,
  reuseSessionId?: string,
) {
  await mkdir(job.directory, { recursive: true });

  const sendWithReuse = async (sid: string) => {
    try {
      const result = await sendMessage(sid, {
        agent: "build",
        parts: [{ type: "text", text: promptContent }],
      });
      if (result.info.finish !== "stop" && result.info.finish !== "end_turn") {
        throw new Error(
          `OpenCode followup finished with unexpected status: ${result.info.finish}`,
        );
      }
      return result;
    } catch (err) {
      return { error: err };
    }
  };

  // Try to reuse existing session
  if (reuseSessionId) {
    const result = await sendWithReuse(reuseSessionId);
    if (!("error" in result)) return;
  }

  // Reuse failed or no session exists — create new session with full context
  const session = await createSession({
    title: `followup-${manifest.id}-job-${job.id}`,
  });
  await writeFile(
    path.join(job.directory, "session-id.txt"),
    session.id + "\n",
    "utf8",
  );

  const context = await buildFollowupContext(job);
  if (context) {
    // First inject context so the new session knows what's been done
    const ctxResult = await sendMessage(session.id, {
      agent: "build",
      parts: [{ type: "text", text: context + "\n请理解以上上下文，暂不修改任何文件。" }],
    });
    if (ctxResult.info.finish !== "stop" && ctxResult.info.finish !== "end_turn") {
      console.warn(`Followup context injection for job ${job.id} had unexpected finish: ${ctxResult.info.finish}`);
    }
  }

  const result = await sendMessage(session.id, {
    agent: "build",
    parts: [{ type: "text", text: promptContent }],
  });
  if (result.info.finish !== "stop" && result.info.finish !== "end_turn") {
    throw new Error(
      `OpenCode followup finished with unexpected status: ${result.info.finish}`,
    );
  }
}

// ── public API ──

export async function startBatchWebRun(batchId: string) {
  const batch = await readCardBatch(batchId);

  // 检查是否已有在内存中运行的实例
  const existing = running.get(batchId);
  if (existing) {
    return readWebRunStatus(batchId);
  }

  // 检查磁盘状态：如果上次运行未正常结束（进程重启等），标记为失败
  const prevStatus = await readWebRunStatus(batchId);
  if (prevStatus.status === "RUNNING") {
    console.warn(`Batch ${batchId}: 检测到僵尸 RUNNING 状态（上次进程可能崩溃），标记为 FAILED`);
    await writeStatus(batch.rootDirectory, {
      ...prevStatus,
      status: "FAILED",
      endedAt: new Date().toISOString(),
      error: "进程重启导致运行中断",
    });
  }

  const manifestPath = path.join(batch.rootDirectory, "batch.json");
  const abort = new AbortController();
  running.set(batchId, abort);

  const started: WebRunStatus = {
    batchId,
    status: "RUNNING",
    startedAt: new Date().toISOString(),
  };
  await writeStatus(batch.rootDirectory, started);

  (async () => {
    try {
      await ensureOpendexServer();

      const manifest = JSON.parse(
        await readFile(manifestPath, "utf8"),
      ) as CardBatchManifest;

      const jobs = manifest.jobs;
      const concurrency = Math.max(1, batch.concurrency);

      const pendingJobs = jobs.filter(
        (j) => j.status !== "EXPORTED" && j.status !== "DONE",
      );

      let runError: string | undefined;
      try {
        await runWithConcurrency(pendingJobs, concurrency, async (job) => {
          if (abort.signal.aborted) return;
          await runJob(manifestPath, manifest, job);
        });
      } catch (error) {
        // Some jobs failed, but the rest continued — still aggregate
        runError = error instanceof Error ? error.message : String(error);
        console.warn(`Batch ${batchId}: some jobs failed, aggregating rest. First error: ${runError}`);
      }

      if (abort.signal.aborted) return;

      const aggregated = await aggregateBatch(manifest, manifestPath);

      await writeStatus(batch.rootDirectory, {
        ...started,
        status: runError ? "DONE" : "DONE",
        endedAt: new Date().toISOString(),
        error: runError,
      });
      console.log(
        `Batch ${batchId} done: ${aggregated.totalCards} cards → ${aggregated.reportPath}` +
          (runError ? ` (some jobs failed)` : ""),
      );
      running.delete(batchId);
    } catch (error) {
      running.delete(batchId);
      await writeStatus(batch.rootDirectory, {
        ...started,
        status: "FAILED",
        endedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`Batch ${batchId} failed:`, error);
    }
  })();

  return started;
}

export async function startFollowupWebRun(params: {
  batchId: string;
  jobId: string;
  promptPath: string;
}) {
  const batch = await readCardBatch(params.batchId);
  const job = batch.jobs.find((j) => j.id === params.jobId);
  if (!job) throw new Error(`找不到任务 ${params.jobId}`);

  const key = `${params.batchId}:${params.jobId}`;
  const existing = runningFollowups.get(key);
  if (existing) {
    return { batchId: params.batchId, jobId: params.jobId, status: "RUNNING" };
  }

  const promptRaw = await readFile(params.promptPath, "utf8");
  const promptText = buildFollowupPrompt(promptRaw);

  // Try to reuse the original session for context continuity
  const sessionIdPath = path.join(job.directory, "session-id.txt");
  let reuseSessionId: string | undefined;
  if (existsSync(sessionIdPath)) {
    try {
      reuseSessionId = (await readFile(sessionIdPath, "utf8")).trim();
    } catch {
      // session file unreadable, will create new session
    }
  }

  const abort = new AbortController();
  runningFollowups.set(key, abort);

  (async () => {
    try {
      await ensureOpendexServer();
      await runFollowupViaApi(batch, job, promptText, reuseSessionId);

      // Re-validate job and update batch manifest after followup
      const manifestPath = path.join(batch.rootDirectory, "batch.json");
      const manifest = JSON.parse(
        await readFile(manifestPath, "utf8"),
      ) as CardBatchManifest;
      const jobInManifest = manifest.jobs.find((j) => j.id === params.jobId);
      if (jobInManifest) {
        const { cards, error } = await readJobCards(jobInManifest);
        const hasIteration = existsSync(
          path.join(jobInManifest.directory, "iteration.md"),
        );
        const validation = cards.map((card, idx) =>
          validateCard(card, idx + 1),
        );
        const issues = [
          error,
          hasIteration ? null : "缺少 iteration.md",
          ...validation.flatMap((item) =>
            item.issues.map((issue) => `卡片 ${item.index}: ${issue}`),
          ),
        ].filter(Boolean);
        const issueText = issues.join("；");

        jobInManifest.status = !error && validation.every((item) => item.ok)
          ? "EXPORTED"
          : "FAILED";
        jobInManifest.followupCount = (jobInManifest.followupCount ?? 0) + 1;
        jobInManifest.lastFollowupAt = new Date().toISOString();

        await writeFile(
          path.join(jobInManifest.directory, "runner-validation.json"),
          JSON.stringify({ ok: !issueText, issues }, null, 2),
          "utf8",
        );
        await atomicWriteFile(manifestPath, JSON.stringify(manifest, null, 2));
      }
    } catch (error) {
      console.error(
        `Followup failed for job ${params.jobId} in batch ${params.batchId}:`,
        error,
      );
    } finally {
      runningFollowups.delete(key);
    }
  })();

  return { batchId: params.batchId, jobId: params.jobId, status: "RUNNING" };
}

export async function startWorkflowIterationWebRun(batchId: string) {
  const batch = await readCardBatch(batchId);
  const existing = runningIterations.get(batchId);
  if (existing) {
    return { batchId, status: "RUNNING" };
  }

  const promptPath = path.join(batch.rootDirectory, "after-import-iteration.md");
  const jobIterationFiles = batch.jobs
    .map((job) => path.join(job.directory, "iteration.md"))
    .join("\n");
  const content = [
    "# 入库后工作流迭代",
    "",
    "本批次卡片已经完成一键入库。请不要修改数据库，不要创建新卡片。",
    "",
    "请读取并依据以下文件进行批次级工作流迭代：",
    "",
    "- docs/CARD-WORKFLOW.md",
    "- docs/卡片工作流-使用与迭代.md",
    `- ${path.join(batch.rootDirectory, "exports", "import-report.md")}`,
    `- ${path.join(batch.rootDirectory, "exports", "review-report.md")}`,
    "",
    "本批次各任务 iteration.md：",
    "",
    jobIterationFiles,
    "",
    "目标：",
    "",
    "1. 回顾本批次各任务 iteration.md 中的卡片问题和流程问题。",
    "2. 如果有退回案例或反复问题，按既有文档格式追加到 CARD-WORKFLOW.md 的退回案例库。",
    "3. 如果同类问题已经反复出现，将其提炼成正文规则。",
    "4. 检查两份工作流文档之间是否有矛盾。",
    "5. 在本批次目录写出 workflow-iteration-report.md，说明改了什么、没改什么、仍需人工判断什么。",
  ].join("\n");

  await writeFile(promptPath, content, "utf8");

  const abort = new AbortController();
  runningIterations.set(batchId, abort);

  (async () => {
    try {
      await ensureOpendexServer();
      const session = await createSession({
        title: `workflow-iteration-${batchId}`,
      });
      const result = await sendMessage(session.id, {
        agent: "build",
        parts: [{ type: "text", text: content }],
      });

      const transcript = result.parts
        .filter((p) => p.type === "text" || p.type === "reasoning")
        .map((p) => `[${p.type}]\n${p.text ?? ""}\n`)
        .join("\n");
      await writeFile(
        path.join(batch.rootDirectory, "workflow-iteration-transcript.md"),
        transcript,
        "utf8",
      );
    } catch (error) {
      console.error(`Workflow iteration failed for batch ${batchId}:`, error);
    } finally {
      runningIterations.delete(batchId);
    }
  })();

  return { batchId, status: "RUNNING" };
}
