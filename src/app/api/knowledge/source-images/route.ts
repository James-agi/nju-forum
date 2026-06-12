import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireKnowledgeAuthor } from "@/lib/knowledge/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOWNLOAD_IMAGES = 5;
const MAX_CANDIDATES = 12;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; NJUForumKnowledgeImageImporter/1.0)";

const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
]);

const previewSchema = z.object({
  action: z.literal("preview"),
  url: z.string().trim().min(1).max(2048),
});

const downloadSchema = z.object({
  action: z.literal("download"),
  imageUrls: z
    .array(z.string().trim().min(1).max(2048))
    .min(1)
    .max(MAX_DOWNLOAD_IMAGES),
});

const requestSchema = z.discriminatedUnion("action", [
  previewSchema,
  downloadSchema,
]);

interface ImageCandidate {
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  source: "direct" | "page";
}

class SourceImageError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function parseHttpUrl(value: string, name = "URL") {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SourceImageError(`${name} 格式不正确`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SourceImageError(`${name} 只支持 http/https`);
  }

  return url;
}

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

function isPrivateAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

async function validateRemoteUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SourceImageError("URL 只支持 http/https");
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new SourceImageError("不支持 localhost 或内网地址");
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new SourceImageError("不支持 localhost 或内网地址");
    }
    return;
  }

  const addresses = await lookup(hostname, { all: true });
  if (addresses.length === 0 || addresses.some((item) => isPrivateAddress(item.address))) {
    throw new SourceImageError("不支持 localhost 或内网地址");
  }
}

async function fetchValidated(
  url: URL,
  init: RequestInit,
  redirectCount = 0
): Promise<{ response: Response; finalUrl: URL }> {
  if (redirectCount > MAX_REDIRECTS) {
    throw new SourceImageError("URL 重定向次数过多");
  }

  await validateRemoteUrl(url);

  const response = await fetch(url, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      "User-Agent": USER_AGENT,
      ...(init.headers ?? {}),
    },
  });

  if (
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.has("location")
  ) {
    const nextUrl = new URL(response.headers.get("location")!, url);
    response.body?.cancel();
    return fetchValidated(nextUrl, init, redirectCount + 1);
  }

  return { response, finalUrl: url };
}

function getNormalizedContentType(response: Response) {
  return response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
}

async function probeDirectImage(url: URL): Promise<ImageCandidate | null> {
  const probeMethods: RequestInit[] = [
    { method: "HEAD" },
    { method: "GET", headers: { Range: "bytes=0-0" } },
  ];

  for (const init of probeMethods) {
    try {
      const { response, finalUrl } = await fetchValidated(url, init);
      const contentType = getNormalizedContentType(response);
      response.body?.cancel();

      if (response.ok && ALLOWED_IMAGE_TYPES.has(contentType)) {
        return {
          url: finalUrl.toString(),
          alt: null,
          width: null,
          height: null,
          source: "direct",
        };
      }
    } catch {
      // Fall through to page extraction. The download step will report
      // detailed errors if the URL is selected as an image.
    }
  }

  return null;
}

function normalizeCandidateUrl(rawUrl: string, baseUrl: URL) {
  if (!rawUrl || rawUrl.startsWith("data:") || rawUrl.startsWith("blob:")) {
    return null;
  }

  const url = new URL(rawUrl, baseUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.pathname.toLowerCase().endsWith(".svg")) return null;
  url.hash = "";
  return url;
}

function cleanDimension(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

async function extractPageImageCandidates(url: URL): Promise<ImageCandidate[]> {
  await validateRemoteUrl(url);

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      userAgent: USER_AGENT,
      viewport: { width: 1440, height: 1000 },
    });

    await page.route("**/*", async (route) => {
      try {
        const requestUrl = new URL(route.request().url());
        await validateRemoteUrl(requestUrl);
        await route.continue();
      } catch {
        await route.abort("blockedbyclient");
      }
    });

    await page.goto(url.toString(), {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(1_000);

    const rawCandidates = await page.evaluate(() => {
      const pickFromSrcset = (srcset: string | null) => {
        if (!srcset) return "";
        const entries = srcset
          .split(",")
          .map((entry) => entry.trim().split(/\s+/)[0])
          .filter(Boolean);
        return entries.at(-1) ?? "";
      };

      const candidates: Array<{
        url: string;
        alt: string | null;
        width: number | null;
        height: number | null;
      }> = [];

      const add = (
        url: string,
        alt: string | null,
        width: number | null,
        height: number | null
      ) => {
        if (!url) return;
        candidates.push({ url, alt, width, height });
      };

      document
        .querySelectorAll<HTMLMetaElement>(
          'meta[property="og:image"], meta[name="twitter:image"]'
        )
        .forEach((meta) => add(meta.content, "页面分享图", null, null));

      document.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
        add(
          img.currentSrc || img.src || pickFromSrcset(img.srcset),
          img.alt?.trim() || null,
          img.naturalWidth || img.width || null,
          img.naturalHeight || img.height || null
        );
      });

      document.querySelectorAll<HTMLSourceElement>("source[srcset]").forEach((source) => {
        add(pickFromSrcset(source.srcset), null, null, null);
      });

      return candidates;
    });

    const seen = new Set<string>();
    const candidates: ImageCandidate[] = [];

    for (const candidate of rawCandidates) {
      const candidateUrl = normalizeCandidateUrl(candidate.url, url);
      if (!candidateUrl || seen.has(candidateUrl.toString())) continue;

      const width = cleanDimension(candidate.width);
      const height = cleanDimension(candidate.height);
      const isTiny = width !== null && height !== null && (width < 80 || height < 80);
      if (isTiny) continue;

      try {
        await validateRemoteUrl(candidateUrl);
      } catch {
        continue;
      }

      seen.add(candidateUrl.toString());
      candidates.push({
        url: candidateUrl.toString(),
        alt: candidate.alt?.slice(0, 120) ?? null,
        width,
        height,
        source: "page",
      });

      if (candidates.length >= MAX_CANDIDATES) break;
    }

    return candidates;
  } finally {
    await browser.close();
  }
}

async function readBodyLimited(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new SourceImageError("图片响应为空");

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new SourceImageError("单张图片不能超过 5MB");
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

async function downloadImage(value: string) {
  const url = parseHttpUrl(value, "图片 URL");
  const { response, finalUrl } = await fetchValidated(url, { method: "GET" });

  if (!response.ok) {
    response.body?.cancel();
    throw new SourceImageError("图片下载失败", response.status >= 500 ? 502 : 400);
  }

  const contentType = getNormalizedContentType(response);
  const extension = ALLOWED_IMAGE_TYPES.get(contentType);
  if (!extension) {
    response.body?.cancel();
    throw new SourceImageError("只支持 jpg/png/webp/gif/avif 图片");
  }

  const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
    response.body?.cancel();
    throw new SourceImageError("单张图片不能超过 5MB");
  }

  const buffer = await readBodyLimited(response);
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  const filename = `${Date.now()}-${hash}.${extension}`;
  const imageDir = path.join(process.cwd(), "public", "knowledge-images");
  const filePath = path.join(imageDir, filename);

  await mkdir(imageDir, { recursive: true });
  await writeFile(filePath, buffer, { flag: "wx" });

  return {
    originalUrl: url.toString(),
    finalUrl: finalUrl.toString(),
    publicUrl: `/knowledge-images/${filename}`,
    contentType,
    bytes: buffer.byteLength,
  };
}

export async function POST(req: Request) {
  try {
    const authz = await requireKnowledgeAuthor();
    if (!authz.ok) return authz.response;

    const payload = requestSchema.safeParse(await req.json());
    if (!payload.success) {
      return NextResponse.json({ error: "图片导入参数不正确" }, { status: 400 });
    }

    if (payload.data.action === "preview") {
      const url = parseHttpUrl(payload.data.url);
      const directCandidate = await probeDirectImage(url);
      if (directCandidate) {
        return NextResponse.json({
          mode: "direct",
          candidates: [directCandidate],
        });
      }

      const candidates = await extractPageImageCandidates(url);
      return NextResponse.json({
        mode: "page",
        candidates,
      });
    }

    const images = await Promise.all(
      payload.data.imageUrls.map((imageUrl) => downloadImage(imageUrl))
    );
    const markdown = images
      .map((image, index) => {
        const suffix = images.length > 1 ? index + 1 : "";
        return `![原文图片${suffix}](${image.publicUrl})`;
      })
      .join("\n");

    return NextResponse.json({ images, markdown });
  } catch (error) {
    if (error instanceof SourceImageError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Error importing source images:", error);
    return NextResponse.json({ error: "图片导入失败" }, { status: 500 });
  }
}
