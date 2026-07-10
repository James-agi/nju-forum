import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-utils";
import {
  MATERIAL_TYPE_LABELS,
  materialSubmissionSchema,
  websiteFeedbackSchema,
} from "@/lib/feedback/validation";
import { formatValidationError } from "@/lib/knowledge/validation";
import {
  removeMaterialFiles,
  saveMaterialFiles,
  type SavedMaterialFile,
} from "@/lib/feedback/material-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getFiles(formData: FormData) {
  return formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.ceil(bytes / 1024)}KB`;
  return `${bytes}B`;
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

  let savedFiles: SavedMaterialFile[];
  try {
    savedFiles = await saveMaterialFiles(files, userId);
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
    await removeMaterialFiles(savedFiles);
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
