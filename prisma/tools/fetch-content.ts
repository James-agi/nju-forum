/**
 * 统一内容抓取工具
 * 用法：npx tsx prisma/tools/fetch-content.ts <url> [--json] [--markdown] [--report <path>]
 *
 * 自动判断 URL 类型：
 * - PDF 文件 → fetch-pdf.ts
 * - 语雀页面 → fetch-yuque.ts
 * - 其他网页 → Skill 多策略提取，不足时降级 Playwright
 *
 * 输出选项：
 * - 默认：纯文本（向后兼容）
 * - --json：完整 JSON（含 title/author/markdown/quality）
 * - --markdown：仅输出 Markdown
 * - --report <path>：输出结构化执行日志到文件（用于监控）
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { FetchLogger } from "./fetch-logger";

const MIN_TEXT_LENGTH = 200;

// Skill 脚本路径（绝对路径，避免 cwd 问题）
const SKILL_SCRIPTS_DIR = "C:/Users/HP/Documents/Codex/2026-06-08/skill/outputs/web-content-fetcher/scripts";
const FETCH_URL_SCRIPT = path.join(SKILL_SCRIPTS_DIR, "fetch_url.py");

// 检查 Python 是否可用
function findPython(): string | null {
  const candidates = ["python", "python3"];
  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: "ignore" });
      return cmd;
    } catch {
      // 继续尝试下一个
    }
  }
  return null;
}

// 检查 Skill 脚本是否可用
function isSkillAvailable(): boolean {
  return existsSync(FETCH_URL_SCRIPT);
}

function isPdf(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

function isYuque(url: string): boolean {
  return /yuque\.com/.test(url);
}

function isGitBook(url: string): boolean {
  return /gitbook\.io/.test(url);
}

interface SkillResult {
  url: string;
  final_url: string;
  status_code: number | null;
  title: string;
  author: string;
  published_at: string;
  text: string;
  markdown: string;
  links: Array<{ url: string; text: string }>;
  images: Array<{ url: string; alt: string }>;
  metadata: Record<string, unknown>;
  structured_data: Record<string, unknown>;
  fetch_method: string;
  quality: {
    level: "empty" | "thin" | "usable";
    text_length: number;
    line_count: number;
    link_count: number;
  };
  errors: Array<{ stage: string; category: string; message: string }>;
}

// 调用 Skill 的 fetch_url.py
function skillFetch(url: string): SkillResult | null {
  const python = findPython();
  if (!python) {
    console.error("Python 不可用，跳过 Skill 提取");
    return null;
  }

  if (!isSkillAvailable()) {
    console.error("Skill 脚本不可用，跳过 Skill 提取");
    return null;
  }

  try {
    // 使用 --render-js 启用 Playwright 降级，--pretty 输出格式化 JSON
    const result = execSync(
      `${python} "${FETCH_URL_SCRIPT}" "${url}" --render-js --pretty`,
      {
        encoding: "utf-8",
        cwd: SKILL_SCRIPTS_DIR, // 在脚本目录执行，确保 import 正常
        timeout: 60000, // 60 秒超时
        stdio: ["pipe", "pipe", "pipe"], // 捕获 stderr
      }
    );

    const data = JSON.parse(result) as SkillResult;

    // 记录 errors（如果有）
    if (data.errors && data.errors.length > 0) {
      for (const err of data.errors) {
        console.warn(`[Skill] ${err.stage}: ${err.message}`);
      }
    }

    return data;
  } catch (e) {
    console.error(`Skill 调用失败：${(e as Error).message}`);
    return null;
  }
}

async function httpFetch(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();

  // 简单 HTML → 文字转换
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, "");
  text = text.replace(/<header[\s\S]*?<\/header>/gi, "");
  text = text.replace(/<[^>]+>/g, "\n");
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  text = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");

  return text;
}

async function playwrightFetch(url: string): Promise<string> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    const text = await page.evaluate(() => {
      // 移除导航、侧边栏、页脚等非内容区域
      const remove = document.querySelectorAll("nav, footer, header, [role='navigation'], aside");
      remove.forEach((el) => el.remove());
      const main = document.querySelector("main, article, [role='main'], .content, .page-body");
      return (main || document.body).innerText;
    });
    return text;
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const url = args.find((a) => !a.startsWith("--"));
  const jsonMode = args.includes("--json");
  const markdownMode = args.includes("--markdown");
  const reportIndex = args.indexOf("--report");
  const reportPath = reportIndex >= 0 ? args[reportIndex + 1] : null;

  if (!url) {
    console.error("Usage: npx tsx prisma/tools/fetch-content.ts <url> [--json] [--markdown] [--report <path>]");
    process.exit(1);
  }

  const logger = new FetchLogger(url);

  // PDF → 委托 fetch-pdf.ts
  if (isPdf(url)) {
    logger.addStep("pdf-detect", "success", "URL 匹配 PDF 模式");
    logger.setFinalMethod("fetch-pdf.ts");
    console.log("检测到 PDF，调用 fetch-pdf.ts...");
    try {
      execSync(`npx tsx prisma/tools/fetch-pdf.ts "${url}"`, {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      logger.setSuccess("usable", 0);
    } catch (e) {
      logger.setFailure(`PDF 处理失败: ${(e as Error).message}`);
      logger.addError((e as Error).message);
    }
    outputReport(logger, reportPath);
    return;
  }

  // 语雀 → 委托 fetch-yuque.ts
  if (isYuque(url)) {
    logger.addStep("yuque-detect", "success", "URL 匹配语雀模式");
    logger.setFinalMethod("fetch-yuque.ts");
    console.log("检测到语雀页面，调用 fetch-yuque.ts...");
    try {
      execSync(`npx tsx prisma/tools/fetch-yuque.ts "${url}"`, {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      logger.setSuccess("usable", 0);
    } catch (e) {
      logger.setFailure(`语雀处理失败: ${(e as Error).message}`);
      logger.addError((e as Error).message);
    }
    outputReport(logger, reportPath);
    return;
  }

  // JS 渲染型站点 → 直接 Playwright
  if (isGitBook(url)) {
    logger.addStep("gitbook-detect", "success", "URL 匹配 GitBook 模式");
    logger.addStep("playwright", "success", "GitBook 强制使用 Playwright");
    logger.setFinalMethod("playwright");
    console.log("检测到 GitBook，使用 Playwright 渲染...");
    try {
      const text = await playwrightFetch(url);
      logger.setSuccess(text.trim().length >= MIN_TEXT_LENGTH ? "usable" : "thin", text.trim().length);
      console.log(`\n===== 网页内容 =====\n`);
      console.log(text);
    } catch (e) {
      logger.setFailure(`Playwright 渲染失败: ${(e as Error).message}`);
      logger.addError((e as Error).message);
    }
    outputReport(logger, reportPath);
    return;
  }

  // 通用网页 → 优先 Skill 多策略提取
  logger.addStep("skill", "success", "开始 Skill 多策略提取");
  console.log("Skill 多策略提取中...");
  const skillResult = skillFetch(url);

  if (skillResult && skillResult.quality.level !== "empty") {
    // Skill 提取成功
    logger.addStep("skill", "success", `方法: ${skillResult.fetch_method}, 质量: ${skillResult.quality.level}`);
    logger.setFinalMethod(`skill/${skillResult.fetch_method}`);
    logger.setSuccess(skillResult.quality.level, skillResult.quality.text_length);

    if (jsonMode) {
      console.log(JSON.stringify(skillResult, null, 2));
    } else if (markdownMode) {
      console.log(skillResult.markdown || skillResult.text);
    } else {
      console.log(`\n===== 网页内容 =====\n`);
      console.log(skillResult.markdown || skillResult.text);
    }
    outputReport(logger, reportPath);
    return;
  }

  // Skill 提取失败或结果为空
  const skillError = skillResult?.errors?.[0]?.message || "结果为空";
  logger.addStep("skill", "failed", skillError);
  logger.addError(`Skill: ${skillError}`);
  console.log("Skill 提取不足，降级到 HTTP + Playwright...");

  // HTTP 抓取
  let text: string;
  try {
    logger.addStep("http", "success");
    text = await httpFetch(url);
  } catch (e) {
    const httpError = (e as Error).message;
    logger.addStep("http", "failed", httpError);
    logger.addError(`HTTP: ${httpError}`);
    console.log(`HTTP 抓取失败：${httpError}，降级 Playwright...`);
    try {
      logger.addStep("playwright", "success", "HTTP 失败后降级");
      text = await playwrightFetch(url);
    } catch (e2) {
      logger.addStep("playwright", "failed", (e2 as Error).message);
      logger.setFailure(`HTTP 和 Playwright 均失败: ${httpError} / ${(e2 as Error).message}`);
      text = "";
    }
  }

  // 内容不足时降级 Playwright
  if (text.trim().length < MIN_TEXT_LENGTH) {
    console.log(`HTTP 内容不足（${text.trim().length} 字符），降级 Playwright...`);
    try {
      logger.addStep("playwright", "success", "HTTP 内容不足后降级");
      text = await playwrightFetch(url);
    } catch (e) {
      logger.addStep("playwright", "failed", (e as Error).message);
      if (text.trim().length === 0) {
        logger.setFailure(`所有方法均失败，内容为空`);
      } else {
        logger.addError(`Playwright 降级失败: ${(e as Error).message}`);
      }
    }
  }

  // 确定最终方法
  const hasPlaywright = logger.getReport().steps.some(
    (s) => s.name === "playwright" && s.status === "success"
  );
  logger.setFinalMethod(hasPlaywright ? "playwright" : "http");

  // 设置成功状态
  const finalTextLength = text.trim().length;
  const quality = finalTextLength >= MIN_TEXT_LENGTH ? "usable" :
                  finalTextLength > 0 ? "thin" : "empty";
  if (quality !== "empty") {
    logger.setSuccess(quality, finalTextLength);
  } else {
    logger.setFailure("所有方法均无法提取有效内容");
  }

  // 输出内容
  if (jsonMode) {
    console.log(JSON.stringify({
      url,
      final_url: url,
      status_code: null,
      title: "",
      author: "",
      published_at: "",
      text,
      markdown: text,
      links: [],
      images: [],
      metadata: {},
      structured_data: {},
      fetch_method: hasPlaywright ? "playwright" : "http",
      quality: {
        level: quality,
        text_length: finalTextLength,
        line_count: text.split("\n").filter((l) => l.trim()).length,
        link_count: 0,
      },
      errors: [{ stage: "skill", category: "fallback", message: "Skill 提取失败，使用降级方案" }],
    }, null, 2));
  } else if (markdownMode) {
    console.log(text);
  } else {
    console.log(`\n===== 网页内容 =====\n`);
    console.log(text);
  }

  outputReport(logger, reportPath);
}

function outputReport(logger: FetchLogger, reportPath: string | null) {
  // 输出到 stderr（会被记录到 transcript）
  console.error(logger.formatReport());

  // 如果指定了 --report 路径，输出 JSON 文件
  if (reportPath) {
    logger.writeReportToFile(reportPath);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
