import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-utils";
import {
  MATERIAL_TYPE_LABELS,
  materialSubmissionSchema,
  websiteFeedbackSchema,
} from "@/lib/feedback/validation";
import { formatValidationError } from "@/lib/knowledge/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_MATERIAL_BYTES = 20 * 1024 * 1024;
const MAX_MATERIAL_FILES = 3;

const ALLOWED_MATERIAL_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".txt",
  ".md",
  ".csv",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".zip",
]);

type SavedMaterialFile = {
  originalName: string;
  filename: string;
  filePath: string;
  bytes: number;
  contentType: string;
  downloadUrl: string;
};

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getFiles(formData: FormData) {
  return formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

function cleanOriginalName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 120) || "资料文件";
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.ceil(bytes / 1024)}KB`;
  return `${bytes}B`;
}

async function saveMaterialFiles(files: File[]) {
  if (files.length > MAX_MATERIAL_FILES) {
    throw new Error(`一次最多上传 ${MAX_MATERIAL_FILES} 个文件`);
  }

  const materialDir = path.join(process.cwd(), "storage", "feedback-materials");
  await mkdir(materialDir, { recursive: true });

  const savedFiles: SavedMaterialFile[] = [];

  for (const file of files) {
    const extension = path.extname(file.name).toLowerCase();
    if (!ALLOWED_MATERIAL_EXTENSIONS.has(extension)) {
      throw new Error("只支持 PDF、Office、文本、图片或 zip 资料文件");
    }

    if (file.size > MAX_MATERIAL_BYTES) {
      throw new Error("单个资料文件不能超过 20MB");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > MAX_MATERIAL_BYTES) {
      throw new Error("单个资料文件不能超过 20MB");
    }

    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const filePath = path.join(materialDir, filename);
    await writeFile(filePath, buffer, { flag: "wx" });

    savedFiles.push({
      originalName: cleanOriginalName(file.name),
      filename,
      filePath,
      bytes: buffer.byteLength,
      contentType: file.type || "application/octet-stream",
      downloadUrl: `/api/admin/feedback/materials/${filename}`,
    });
  }

  return savedFiles;
}

async function getActiveUser() {
  const session = await getSession();
  if (!session?.user) {
    return { error: fail("请先登录", 401) };
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.banned) {
    return { error: fail("账号已被封禁", 403) };
  }

  return { user };
}

async function createJsonFeedback(req: Request, userId: string) {
  const payload = await req.json();
  const parsed = websiteFeedbackSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  const feedback = await db.websiteFeedback.create({
    data: {
      userId,
      category: parsed.data.category,
      content: parsed.data.content,
      contact: parsed.data.contact ?? null,
    },
  });

  return NextResponse.json({ id: feedback.id });
}

async function createMaterialFeedback(req: Request, userId: string) {
  const formData = await req.formData();
  const files = getFiles(formData);
  const parsed = materialSubmissionSchema.safeParse({
    title: formData.get("title"),
    materialType: formData.get("materialType"),
    sourceUrl: formData.get("sourceUrl"),
    note: formData.get("note"),
    contact: formData.get("contact"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  if (!parsed.data.sourceUrl && files.length === 0 && !parsed.data.note) {
    return fail("请至少填写资料链接、上传文件或补充说明");
  }

  let savedFiles;
  try {
    savedFiles = await saveMaterialFiles(files);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "资料文件上传失败");
  }

  const lines = [
    "【资料提交】",
    `资料标题：${parsed.data.title ?? "未填写"}`,
    `资料类型：${MATERIAL_TYPE_LABELS[parsed.data.materialType]}`,
  ];

  if (parsed.data.sourceUrl) {
    lines.push(`URL：${parsed.data.sourceUrl}`);
  }

  if (savedFiles.length > 0) {
    lines.push("文件：");
    for (const file of savedFiles) {
      lines.push(
        `- ${file.originalName}（${formatBytes(file.bytes)}，${file.contentType}）`
      );
      lines.push(`  下载：${file.downloadUrl}`);
    }
  }

  if (parsed.data.note) {
    lines.push("", "补充说明：", parsed.data.note);
  }

  lines.push("", "用途提示：该资料由用户提交，用于知识库内容迭代，入库前仍需人工核验来源与时效。");

  let feedback;
  try {
    feedback = await db.websiteFeedback.create({
      data: {
        userId,
        category: "MATERIAL",
        content: lines.join("\n"),
        contact: parsed.data.contact ?? null,
      },
    });
  } catch (error) {
    await Promise.allSettled(savedFiles.map((file) => unlink(file.filePath)));
    throw error;
  }

  return NextResponse.json({ id: feedback.id });
}

export async function POST(req: Request) {
  try {
    const auth = await getActiveUser();
    if (auth.error) return auth.error;

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      return createMaterialFeedback(req, auth.user.id);
    }

    return createJsonFeedback(req, auth.user.id);
  } catch (error) {
    console.error("Error creating feedback:", error);
    return NextResponse.json({ error: "提交失败" }, { status: 500 });
  }
}
