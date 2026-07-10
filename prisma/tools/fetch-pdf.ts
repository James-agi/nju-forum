/**
 * PDF 内容提取工具
 * 用法：npx tsx prisma/tools/fetch-pdf.ts <url>
 * 支持文字型 PDF 和图片型 PDF（OCR）
 */
import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { FetchLogger } from "./fetch-logger";

const MIN_TEXT_LENGTH = 50;

async function downloadPdf(url: string): Promise<string> {
  // 先尝试直接下载
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    redirect: "follow",
  });

  // 如果是重定向到登录页，尝试用 Playwright 获取
  if (response.status === 302 || response.url?.includes("/login")) {
    console.log("需要认证，尝试用 Playwright 获取...");
    return downloadPdfViaPlaywright(url);
  }

  if (!response.ok) throw new Error(`PDF 下载失败：HTTP ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 100 || !buffer.slice(0, 5).toString().startsWith("%PDF")) {
    console.log("响应不是有效 PDF，尝试用 Playwright 获取...");
    return downloadPdfViaPlaywright(url);
  }

  const tmpPath = path.join(os.tmpdir(), `fetch-pdf-${Date.now()}.pdf`);
  await writeFile(tmpPath, buffer);
  console.log(`PDF 已下载：${tmpPath}（${(buffer.length / 1024).toFixed(1)} KB）`);
  return tmpPath;
}

async function downloadPdfViaPlaywright(url: string): Promise<string> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--disable-gpu", "--no-sandbox"],
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // 拦截 PDF 响应
    let pdfBuffer: Buffer | null = null;
    page.on("response", async (response) => {
      const contentType = response.headers()["content-type"] ?? "";
      if (contentType.includes("pdf")) {
        try {
          const body = await response.body();
          if (body.length > 100 && body.slice(0, 5).toString().startsWith("%PDF")) {
            pdfBuffer = body;
          }
        } catch {}
      }
    });

    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    if (!pdfBuffer) {
      // 尝试从页面中提取 PDF 下载链接
      const downloadUrl = await page.evaluate(() => {
        const link = document.querySelector('a[href*=".pdf"]');
        return link ? (link as HTMLAnchorElement).href : null;
      });

      if (downloadUrl) {
        console.log("找到下载链接，正在下载...");
        const res = await fetch(downloadUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.slice(0, 5).toString().startsWith("%PDF")) {
            pdfBuffer = buf;
          }
        }
      }
    }

    if (!pdfBuffer) {
      // 最后尝试：直接从当前 URL 下载（带 cookies）
      const cookies = await context.cookies();
      const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");
      const res = await fetch(url, {
        headers: { Cookie: cookieHeader, "User-Agent": "Mozilla/5.0" },
        redirect: "follow",
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.slice(0, 5).toString().startsWith("%PDF")) {
          pdfBuffer = buf;
        }
      }
    }

    if (!pdfBuffer) {
      throw new Error("无法获取 PDF 内容（可能需要登录语雀）");
    }

    const tmpPath = path.join(os.tmpdir(), `fetch-pdf-${Date.now()}.pdf`);
    await writeFile(tmpPath, pdfBuffer);
    console.log(`PDF 已下载（Playwright）：${tmpPath}（${(pdfBuffer.length / 1024).toFixed(1)} KB）`);
    return tmpPath;
  } finally {
    await browser.close();
  }
}

async function extractText(pdfPath: string): Promise<{ text: string; pages: number; links: { page: number; url: string; rect: number[] }[] }> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await import("node:fs").then(fs => fs.readFileSync(pdfPath)));
  const doc = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise;
  const pages = doc.numPages;
  const textParts: string[] = [];
  const allLinks: { page: number; url: string; rect: number[] }[] = [];

  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    // 提取文字，保留位置信息用于匹配链接
    const items: { str: string; transform: number[] }[] = content.items.map((item: any) => ({
      str: item.str,
      transform: item.transform,
    }));

    // 提取链接注释
    const annotations = await page.getAnnotations();
    for (const ann of annotations) {
      if (ann.subtype === "Link" && ann.url) {
        allLinks.push({ page: i, url: ann.url, rect: ann.rect || [] });
      }
    }

    // 构建页面文字，尝试在文字中插入链接
    const pageLines: string[] = [];
    let lastY = -1;
    for (const item of items) {
      const y = item.transform[5];
      if (lastY !== -1 && Math.abs(y - lastY) > 2) {
        pageLines.push("\n");
      }
      lastY = y;
      pageLines.push(item.str);
    }
    textParts.push(pageLines.join(""));
  }

  return { text: textParts.join("\n\n"), pages, links: allLinks };
}

async function renderPages(pdfPath: string, outputDir: string): Promise<string[]> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("canvas");
  const fs = await import("node:fs/promises");

  const data = new Uint8Array(await import("node:fs").then(fs => fs.readFileSync(pdfPath)));
  const doc = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise;
  const imagePaths: string[] = [];

  await fs.mkdir(outputDir, { recursive: true });

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");

    await page.render({ canvasContext: ctx as any, viewport }).promise;

    const imagePath = `${outputDir}/page-${String(i).padStart(2, "0")}.png`;
    const buffer = canvas.toBuffer("image/png");
    await fs.writeFile(imagePath, buffer);
    imagePaths.push(imagePath);
    console.log(`渲染第 ${i} 页 → ${imagePath}（${(buffer.length / 1024).toFixed(0)} KB）`);
  }

  return imagePaths;
}

async function ocrPdf(pdfPath: string): Promise<string> {
  // 对于图片型 PDF，使用 tesseract.js OCR
  // 需要先将 PDF 页面渲染为图片
  const Tesseract = await import("tesseract.js");
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("canvas");

  const data = new Uint8Array(await import("node:fs").then(fs => fs.readFileSync(pdfPath)));
  const doc = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise;
  const pages = doc.numPages;
  const textParts: string[] = [];

  const worker = await Tesseract.createWorker("chi_sim+eng");

  for (let i = 1; i <= pages; i++) {
    console.log(`OCR 第 ${i}/${pages} 页...`);
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");

    await page.render({
      canvasContext: ctx as any,
      viewport,
    }).promise;

    const imageBuffer = canvas.toBuffer("image/png");
    const { data: { text } } = await worker.recognize(imageBuffer);
    textParts.push(text);
  }

  await worker.terminate();
  return textParts.join("\n\n");
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: npx tsx prisma/tools/fetch-pdf.ts <url-or-local-path>");
    process.exit(1);
  }

  const logger = new FetchLogger(url);
  logger.setFinalMethod("pdf");

  // 支持本地文件路径
  const fs = await import("node:fs");
  let tmpPath: string;
  let isLocalFile = false;

  if (fs.existsSync(url) && url.toLowerCase().endsWith(".pdf")) {
    tmpPath = url;
    isLocalFile = true;
    logger.addStep("download", "success", "local file");
    console.log(`使用本地 PDF：${tmpPath}`);
  } else {
    try {
      const dlStart = Date.now();
      tmpPath = await downloadPdf(url);
      const dlSize = fs.statSync(tmpPath).size;
      logger.addStep("download", "success", `${Date.now() - dlStart}ms, ${(dlSize / 1024).toFixed(1)}KB`);
    } catch (e) {
      const msg = (e as Error).message;
      logger.addStep("download", "failed", msg);
      logger.setFailure(`PDF 下载失败: ${msg}`);
      logger.addError(msg);
      console.error("PDF 下载失败：", msg);
      if (msg.includes("登录语雀")) {
        console.error("提示：语雀内嵌 PDF 需要登录，请改用 fetch-yuque.ts 访问包含该 PDF 的文档页面");
      }
      console.error(logger.formatReport());
      process.exit(1);
    }
  }

  // 确定输出目录（本地文件用同目录，远程文件用临时目录）
  const fsPromises = await import("node:fs/promises");
  let imageDir: string;
  let imageDirIsTemp = false;
  if (isLocalFile) {
    imageDir = tmpPath.replace(/\.pdf$/i, "") + "-pages";
  } else {
    imageDir = path.join(os.tmpdir(), `fetch-pdf-pages-${Date.now()}`);
    imageDirIsTemp = true;
  }

  try {
    console.log("正在提取文字和链接...");
    const extractStart = Date.now();
    const { text, pages, links } = await extractText(tmpPath);
    const textLen = text.trim().length;
    logger.addStep("text-extract", textLen >= MIN_TEXT_LENGTH ? "success" : "fallback",
      `${pages} pages, ${textLen} chars, ${Date.now() - extractStart}ms`);

    // 渲染页面图片
    let imagePaths: string[] = [];
    try {
      console.log("正在渲染页面图片...");
      const renderStart = Date.now();
      imagePaths = await renderPages(tmpPath, imageDir);
      logger.addStep("render-pages", "success", `${imagePaths.length} pages, ${Date.now() - renderStart}ms`);
    } catch (renderErr) {
      console.warn("页面渲染失败（可能缺少 canvas 依赖）：", (renderErr as Error).message);
      logger.addStep("render-pages", "failed", (renderErr as Error).message);
    }

    if (textLen >= MIN_TEXT_LENGTH) {
      logger.setSuccess("usable", textLen);
      console.log(`\n===== PDF 内容（${pages} 页） =====\n`);
      console.log(text);

      if (links.length > 0) {
        console.log(`\n===== 文档中的超链接（${links.length} 个） =====\n`);
        const seen = new Set<string>();
        for (const link of links) {
          if (!seen.has(link.url)) {
            seen.add(link.url);
            console.log(`[第${link.page}页] ${link.url}`);
          }
        }
      }

      if (imagePaths.length > 0) {
        console.log(`\n===== 页面图片 =====\n`);
        for (const p of imagePaths) {
          console.log(`![](${p})`);
        }
      }
    } else {
      console.log(`文字量不足（${textLen} 字符），尝试 OCR...`);
      try {
        const ocrStart = Date.now();
        const ocrText = await ocrPdf(tmpPath);
        const ocrLen = ocrText.trim().length;
        logger.addStep("ocr", ocrLen >= MIN_TEXT_LENGTH ? "success" : "fallback",
          `${ocrLen} chars, ${Date.now() - ocrStart}ms`);
        if (ocrLen >= MIN_TEXT_LENGTH) {
          logger.setSuccess("usable", ocrLen);
        } else {
          logger.setFailure(`OCR 结果仍不足: ${ocrLen} chars`);
        }
        console.log(`\n===== PDF OCR 内容（${pages} 页） =====\n`);
        console.log(ocrText);
      } catch (ocrErr) {
        console.warn("OCR 失败（可能缺少 canvas 依赖）：", (ocrErr as Error).message);
        logger.addStep("ocr", "failed", (ocrErr as Error).message);
        logger.setFailure(`文字提取不足 (${textLen} chars) 且 OCR 失败`);
        console.log(`\n===== PDF 内容（${pages} 页，文字提取） =====\n`);
        console.log(text || "（无文字内容）");
      }
    }
  } finally {
    if (!isLocalFile) await unlink(tmpPath).catch(() => {});
    if (imageDirIsTemp) await fsPromises.rm(imageDir, { recursive: true, force: true }).catch(() => {});
  }

  // 输出 FETCH REPORT 到 stderr
  console.error(logger.formatReport());
}

main().catch(console.error);
