/**
 * 通用语雀页面爬取工具
 * 用法：npx tsx prisma/tools/fetch-yuque.ts <url>
 * 下载候选图片：npx tsx prisma/tools/fetch-yuque.ts <url> --download-images=1,3
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import path from "node:path";
import { chromium } from "playwright";
import { FetchLogger } from "./fetch-logger";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
]);

interface RawImageCandidate {
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
}

interface ImageCandidate extends RawImageCandidate {
  index: number;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const url = args.find((arg) => !arg.startsWith("--"));
  const downloadArg = args.find((arg) => arg.startsWith("--download-images="));
  const selectedImageIndexes =
    downloadArg
      ?.split("=")[1]
      ?.split(",")
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isInteger(value) && value > 0) ?? [];

  return { url, selectedImageIndexes };
}

function normalizeImageCandidates(rawImages: RawImageCandidate[], baseUrl: string) {
  const seen = new Set<string>();
  const candidates: ImageCandidate[] = [];

  for (const rawImage of rawImages) {
    if (!rawImage.url || rawImage.url.startsWith("data:") || rawImage.url.startsWith("blob:")) {
      continue;
    }

    const url = new URL(rawImage.url, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    if (url.pathname.toLowerCase().endsWith(".svg")) continue;

    url.hash = "";
    const normalizedUrl = url.toString();
    if (seen.has(normalizedUrl)) continue;

    const width = rawImage.width && rawImage.width > 0 ? Math.round(rawImage.width) : null;
    const height = rawImage.height && rawImage.height > 0 ? Math.round(rawImage.height) : null;
    if (width !== null && height !== null && (width < 80 || height < 80)) continue;

    seen.add(normalizedUrl);
    candidates.push({
      index: candidates.length + 1,
      url: normalizedUrl,
      alt: rawImage.alt?.slice(0, 120) ?? null,
      width,
      height,
    });
  }

  return candidates;
}

async function readBodyLimited(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("图片响应为空");

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error("单张图片不能超过 5MB");
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

async function downloadImage(candidate: ImageCandidate) {
  const response = await fetch(candidate.url, { redirect: "follow" });
  if (!response.ok) throw new Error(`图片下载失败：HTTP ${response.status}`);

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  const extension = ALLOWED_IMAGE_TYPES.get(contentType);
  if (!extension) throw new Error(`不支持的图片类型：${contentType || "未知"}`);

  const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
    throw new Error("单张图片不能超过 5MB");
  }

  const buffer = await readBodyLimited(response);
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  const filename = `${Date.now()}-${candidate.index}-${hash}.${extension}`;
  const imageDir = path.join(process.cwd(), "public", "knowledge-images");
  const filePath = path.join(imageDir, filename);

  await mkdir(imageDir, { recursive: true });
  await writeFile(filePath, buffer, { flag: "wx" });

  return {
    publicUrl: `/knowledge-images/${filename}`,
    markdown: `![${candidate.alt || `原文图片${candidate.index}`}](/knowledge-images/${filename})`,
  };
}

// Sheet API 降级：检测是否为 Sheet 类型，通过 API 获取数据
async function trySheetApi(page: any, logger: FetchLogger): Promise<string | null> {
  const appData = await page.evaluate(() => {
    const d = (window as any).appData;
    return d ? { bookId: d.book?.id, docType: d.doc?.type, docTitle: d.doc?.title } : null;
  });

  if (!appData || appData.docType !== "Sheet") return null;

  logger.addStep("sheet-detect", "success", `type=Sheet, book_id=${appData.bookId}`);
  console.log("检测到语雀电子表格，通过 API 获取数据...");

  const apiStart = Date.now();
  const slug = page.url().split("/").pop()?.split("#")[0]?.split("?")[0];
  const bodyJson = await page.evaluate(async (bookId: number) => {
    const res = await fetch(`/api/docs/${window.location.pathname.split("/").pop()?.split("#")[0]}?merge_dynamic_data=false&book_id=${bookId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.body || null;
  }, appData.bookId);

  if (!bodyJson) {
    logger.addStep("sheet-api", "failed", "body is null");
    return null;
  }
  logger.addStep("sheet-api", "success", `${Date.now() - apiStart}ms`);

  let body: any;
  try { body = JSON.parse(bodyJson); } catch { return null; }
  if (!body.sheet) return null;

  const decompressStart = Date.now();
  let sheets: any[];
  try {
    const buf = Buffer.from(body.sheet, "latin1");
    sheets = JSON.parse(inflateSync(buf).toString("utf-8"));
    logger.addStep("sheet-decompress", "success", `${Date.now() - decompressStart}ms, ${sheets.length} sheet(s)`);
  } catch { return null; }

  // 输出 markdown 表格
  const lines: string[] = [`\n===== 语雀电子表格 =====\n`];
  lines.push(`标题：${appData.docTitle || slug}`);
  let totalCells = 0;

  for (const sheet of sheets) {
    const { data, name } = sheet;
    let maxRow = 0, maxCol = 0;
    for (const r of Object.keys(data)) {
      for (const c of Object.keys(data[r])) {
        if (data[r][c]?.v !== undefined && data[r][c].v !== "") {
          maxRow = Math.max(maxRow, Number(r));
          maxCol = Math.max(maxCol, Number(c));
        }
      }
    }
    totalCells += (maxRow + 1) * (maxCol + 1);

    lines.push(`\n### ${name}（${maxRow + 1} 行 × ${maxCol + 1} 列）\n`);
    const rows: string[][] = [];
    for (let r = 0; r <= maxRow; r++) {
      const row: string[] = [];
      for (let c = 0; c <= maxCol; c++) {
        const cell = data[String(r)]?.[String(c)];
        const val = cell?.v;
        row.push(val != null ? String(val).replace(/\n/g, " ").replace(/\|/g, "\\|") : "");
      }
      rows.push(row);
    }
    if (rows.length > 0) {
      lines.push("| " + rows[0].join(" | ") + " |");
      lines.push("| " + rows[0].map(() => "---").join(" | ") + " |");
      for (let i = 1; i < rows.length; i++) {
        lines.push("| " + rows[i].join(" | ") + " |");
      }
    }
  }

  console.log(lines.join("\n"));
  logger.setSuccess("usable", totalCells);
  return "ok";
}

async function main() {
  const { url, selectedImageIndexes } = parseArgs();
  if (!url) {
    console.error("Usage: npx tsx prisma/tools/fetch-yuque.ts <url> [--download-images=1,3]");
    process.exit(1);
  }

  const logger = new FetchLogger(url);
  logger.setFinalMethod("playwright/yuque");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log("正在加载页面...");
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    logger.addStep("page-load", "success");
  } catch (e) {
    logger.addStep("page-load", "failed", (e as Error).message);
    logger.setFailure(`页面加载失败: ${(e as Error).message}`);
    logger.addError((e as Error).message);
    console.error(logger.formatReport());
    await browser.close();
    process.exit(1);
  }

  console.log("等待内容渲染...");
  // 轮询检测内容长度，稳定后才继续（避免懒加载截断）
  let lastLength = 0;
  let stableCount = 0;
  const MAX_WAIT_MS = 30_000;
  const POLL_INTERVAL_MS = 2_000;
  const STABLE_CHECKS = 3;
  const pollStart = Date.now();
  let pollTimedOut = false;
  while (Date.now() - pollStart < MAX_WAIT_MS) {
    await page.waitForTimeout(POLL_INTERVAL_MS);
    const currentLength = await page.evaluate(() => {
      const el = document.querySelector(
        ".yuque-doc-content, .ne-viewer-body, #content, article"
      );
      return ((el as HTMLElement) || document.body).innerText.length;
    });
    if (currentLength === lastLength) {
      stableCount++;
      if (stableCount >= STABLE_CHECKS) break;
    } else {
      stableCount = 0;
    }
    lastLength = currentLength;
  }
  if (Date.now() - pollStart >= MAX_WAIT_MS) pollTimedOut = true;
  const pollDuration = Date.now() - pollStart;
  console.log(
    `内容渲染稳定（${pollDuration}ms, ${lastLength} 字符）`
  );
  logger.addStep("content-poll", pollTimedOut ? "fallback" : "success",
    `${pollDuration}ms, ${lastLength} chars${pollTimedOut ? ", timed out" : ""}`);

  try {
    await page.waitForSelector(
      ".yuque-doc-content, .ne-viewer-body, #content, .lake-engine-view",
      { timeout: 10_000 }
    );
    logger.addStep("selector-wait", "success");
  } catch {
    console.log("未找到指定选择器，尝试通用提取...");
    logger.addStep("selector-wait", "fallback", "selector not found, using generic extraction");
  }

  // 分步提取内容（避免 esbuild __name 问题）
  const text = await page.evaluate(() => {
    const el = document.querySelector(".yuque-doc-content, .ne-viewer-body, #content, article");
    const root = el || document.body;
    const clone = root.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("a[href]").forEach((a) => {
      const href = (a as HTMLAnchorElement).href;
      const text = a.textContent?.trim() || "";
      if (text && href && !href.startsWith("javascript:")) {
        a.replaceWith(document.createTextNode(`[${text}](${href})`));
      }
    });
    return clone.innerText;
  });

  const images = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("img")).map((img) => ({
      url: img.currentSrc || img.src,
      alt: (img.alt || "").trim() || null,
      width: img.naturalWidth || img.width || null,
      height: img.naturalHeight || img.height || null,
    }));
  });

  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href]")).map((a) => ({
      text: (a.textContent || "").trim(),
      href: (a as HTMLAnchorElement).href,
    })).filter((l) => l.text && l.href && !l.href.startsWith("javascript:"));
  });

  const content = { text, images, links };

  const textLen = content.text.trim().length;
  logger.addStep("text-extract", textLen > 0 ? "success" : "failed", `${textLen} chars`);

  // Sheet 降级：DOM 提取内容过薄或命中 Sheet 类型时，走 API
  const isThin = textLen < 200 || content.text.includes("window.appData");
  if (isThin) {
    const sheetResult = await trySheetApi(page, logger);
    if (sheetResult !== null) {
      await browser.close();
      console.error(logger.formatReport());
      return;
    }
  }

  if (textLen > 0) {
    logger.setSuccess(textLen >= 200 ? "usable" : "thin", textLen);
  } else {
    logger.setFailure("提取内容为空");
  }

  console.log("\n===== 页面内容 =====\n");
  console.log(content ? content.text : "content is undefined");

  const finalPageUrl = page.url();
  await browser.close();

  const imageCandidates = normalizeImageCandidates(content.images, finalPageUrl);
  logger.addStep("image-extract", "success", `${imageCandidates.length} candidates`);
  console.log("\n===== 图片候选 =====\n");
  if (imageCandidates.length === 0) {
    console.log("未找到可用图片候选。");
  } else {
    imageCandidates.forEach((image) => {
      const size =
        image.width && image.height ? `${image.width}x${image.height}` : "尺寸未知";
      console.log(`${image.index}. ${image.alt || "未命名图片"} | ${size} | ${image.url}`);
    });
  }

  const uniqueLinks = content.links.filter((l) => !content.links.some((other, i) => other.href === l.href && content.links.indexOf(l) !== i));
  logger.addStep("link-extract", "success", `${uniqueLinks.length} links`);
  console.log("\n===== 超链接 =====\n");
  if (!content.links || content.links.length === 0) {
    console.log("未找到超链接。");
  } else {
    const seen = new Set<string>();
    content.links.forEach((link) => {
      if (!seen.has(link.href)) {
        seen.add(link.href);
        console.log(`- ${link.text}：${link.href}`);
      }
    });
  }

  if (selectedImageIndexes.length > 0) {
    const selectedImages = imageCandidates.filter((image) =>
      selectedImageIndexes.includes(image.index)
    );

    console.log("\n===== 已下载图片 Markdown（追加到 sourceExcerpt） =====\n");
    if (selectedImages.length === 0) {
      console.log("没有匹配到所选图片索引。");
    }

    for (const image of selectedImages) {
      const downloaded = await downloadImage(image);
      console.log(downloaded.markdown);
    }
  }

  // 输出 FETCH REPORT 到 stderr
  console.error(logger.formatReport());
}

main().catch(console.error);
