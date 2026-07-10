/**
 * 语雀电子表格抓取工具
 * 用法：npx tsx prisma/tools/fetch-yuque-sheet.ts <url>
 *
 * 通过 Yuque API 获取 Sheet 类型文档的结构化数据，
 * 解压 zlib 压缩的 sheet 字段，输出可读的 Markdown 表格。
 */
import { inflateSync } from "node:zlib";
import { chromium } from "playwright";
import { FetchLogger } from "./fetch-logger";

interface SheetCell {
  s?: number; // style index
  t?: number; // type (0=string, 1=number, ...)
  v?: string | number; // value
  f?: string; // formula
}

interface SheetData {
  name: string;
  rowCount: number;
  colCount: number;
  data: Record<string, Record<string, SheetCell>>;
}

function parseArgs() {
  // npx tsx sets argv as [node, script, ...args]
  const args = process.argv.slice(2);
  const url = args.find((a) => !a.startsWith("--"));
  return { url };
}

function extractSlug(url: string): { group: string; book: string; slug: string } | null {
  const match = url.match(/yuque\.com\/([^/]+)\/([^/]+)\/([^/#?]+)/);
  if (!match) return null;
  return { group: match[1], book: match[2], slug: match[3] };
}

function decompressSheet(raw: string): SheetData[] {
  const buf = Buffer.from(raw, "latin1");
  const decompressed = inflateSync(buf);
  return JSON.parse(decompressed.toString("utf-8"));
}

function sheetToMarkdown(sheet: SheetData): string {
  const { data, rowCount, colCount, name } = sheet;

  // Find actual data bounds (skip empty rows/cols)
  let maxRow = 0;
  let maxCol = 0;
  for (const rowIdx of Object.keys(data)) {
    const rowNum = Number(rowIdx);
    for (const colIdx of Object.keys(data[rowIdx])) {
      const colNum = Number(colIdx);
      const cell = data[rowIdx][colIdx];
      if (cell?.v !== undefined && cell.v !== "") {
        maxRow = Math.max(maxRow, rowNum);
        maxCol = Math.max(maxCol, colNum);
      }
    }
  }

  if (maxRow === 0 && maxCol === 0) return `### ${name}\n\n（空表）\n`;

  const rows: string[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    const row: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const cell = data[String(r)]?.[String(c)];
      const val = cell?.v;
      row.push(val !== undefined && val !== null ? String(val).replace(/\n/g, " ").replace(/\|/g, "\\|") : "");
    }
    rows.push(row);
  }

  // Build markdown table
  const lines: string[] = [`### ${name}（${maxRow + 1} 行 × ${maxCol + 1} 列）\n`];

  if (rows.length > 0) {
    // Header row
    lines.push("| " + rows[0].join(" | ") + " |");
    lines.push("| " + rows[0].map(() => "---").join(" | ") + " |");
    // Data rows
    for (let i = 1; i < rows.length; i++) {
      lines.push("| " + rows[i].join(" | ") + " |");
    }
  }

  return lines.join("\n");
}

async function main() {
  const { url } = parseArgs();
  if (!url) {
    console.error("Usage: npx tsx prisma/tools/fetch-yuque-sheet.ts <yuque-url>");
    process.exit(1);
  }

  const logger = new FetchLogger(url);
  logger.setFinalMethod("yuque-sheet-api");

  const parsed = extractSlug(url);
  if (!parsed) {
    logger.setFailure("无法解析 Yuque URL");
    console.error(logger.formatReport());
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Step 1: Load page to get book_id and cookies
  let pageLoadStart = Date.now();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    logger.addStep("page-load", "success", `${Date.now() - pageLoadStart}ms`);
  } catch (e) {
    logger.addStep("page-load", "failed", (e as Error).message);
    logger.setFailure(`页面加载失败: ${(e as Error).message}`);
    console.error(logger.formatReport());
    await browser.close();
    process.exit(1);
  }

  // Step 2: Extract book_id from appData
  const appData = await page.evaluate(() => {
    const d = (window as any).appData;
    return {
      bookId: d?.book?.id,
      docType: d?.doc?.type,
      docTitle: d?.doc?.title,
    };
  });

  if (!appData.bookId) {
    logger.addStep("extract-book-id", "failed", "appData.book.id not found");
    logger.setFailure("无法获取 book_id");
    console.error(logger.formatReport());
    await browser.close();
    process.exit(1);
  }
  logger.addStep("extract-book-id", "success", `book_id=${appData.bookId}, type=${appData.docType}`);

  // Step 3: Check if it's a Sheet type
  if (appData.docType !== "Sheet") {
    logger.addStep("type-check", "skipped", `type=${appData.docType}, not Sheet`);
    logger.setFailure(`文档类型不是 Sheet（实际: ${appData.docType}）`);
    console.error(logger.formatReport());
    await browser.close();
    process.exit(1);
  }
  logger.addStep("type-check", "success", "Sheet confirmed");

  // Step 4: Fetch API for sheet data
  const apiStart = Date.now();
  const bodyJson = await page.evaluate(async (bookId) => {
    const res = await fetch(`/api/docs/${window.location.pathname.split("/").pop()?.split("#")[0]}?merge_dynamic_data=false&book_id=${bookId}`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return data.data?.body || null;
  }, appData.bookId);

  if (!bodyJson) {
    logger.addStep("api-fetch", "failed", "body is null");
    logger.setFailure("API 返回 body 为空");
    console.error(logger.formatReport());
    await browser.close();
    process.exit(1);
  }
  logger.addStep("api-fetch", "success", `${Date.now() - apiStart}ms, ${bodyJson.length} chars`);

  await browser.close();

  // Step 5: Parse body JSON
  let body: any;
  try {
    body = JSON.parse(bodyJson);
  } catch (e) {
    logger.addStep("parse-body", "failed", (e as Error).message);
    logger.setFailure("body JSON 解析失败");
    console.error(logger.formatReport());
    process.exit(1);
  }
  logger.addStep("parse-body", "success", `format=${body.format}, sheets=${body.sheet ? "yes" : "no"}`);

  if (!body.sheet) {
    logger.addStep("extract-sheet", "failed", "no sheet field in body");
    logger.setFailure("body 中无 sheet 字段");
    console.error(logger.formatReport());
    process.exit(1);
  }

  // Step 6: Decompress sheet data
  const decompressStart = Date.now();
  let sheets: SheetData[];
  try {
    sheets = decompressSheet(body.sheet);
    logger.addStep("decompress", "success", `${Date.now() - decompressStart}ms, ${sheets.length} sheet(s)`);
  } catch (e) {
    logger.addStep("decompress", "failed", (e as Error).message);
    logger.setFailure("zlib 解压失败");
    console.error(logger.formatReport());
    process.exit(1);
  }

  // Step 7: Output as markdown
  const totalCells = sheets.reduce((sum, s) => sum + s.rowCount * s.colCount, 0);
  logger.setSuccess("usable", totalCells);

  console.log(`\n===== 语雀电子表格 =====\n`);
  console.log(`标题：${appData.docTitle || parsed.slug}`);
  console.log(`来源：${url}`);
  console.log(`Sheet 数：${sheets.length}\n`);

  for (const sheet of sheets) {
    console.log(sheetToMarkdown(sheet));
    console.log("");
  }

  console.error(logger.formatReport());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
