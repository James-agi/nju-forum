import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_IMAGES = 6;

const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
]);

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getFiles(formData: FormData) {
  const values = formData.getAll("images");
  return values.filter((value): value is File => value instanceof File);
}

function cleanAltName(name: string) {
  const baseName = name.replace(/\.[^.]+$/, "").trim();
  return baseName.slice(0, 80) || "帖子图片";
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return fail("请先登录", 401);
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.banned) {
      return fail("账号已被封禁", 403);
    }

    const formData = await req.formData();
    const files = getFiles(formData);

    if (files.length === 0) {
      return fail("请选择要上传的图片");
    }

    if (files.length > MAX_UPLOAD_IMAGES) {
      return fail(`一次最多上传 ${MAX_UPLOAD_IMAGES} 张图片`);
    }

    const imageDir = path.join(process.cwd(), "public", "forum-images");
    await mkdir(imageDir, { recursive: true });

    const images = [];

    for (const file of files) {
      const extension = ALLOWED_IMAGE_TYPES.get(file.type);
      if (!extension) {
        return fail("只支持 jpg/png/webp/gif/avif 图片");
      }

      if (file.size > MAX_IMAGE_BYTES) {
        return fail("单张图片不能超过 5MB");
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.byteLength > MAX_IMAGE_BYTES) {
        return fail("单张图片不能超过 5MB");
      }

      const filename = `${Date.now()}-${randomUUID()}.${extension}`;
      const filePath = path.join(imageDir, filename);
      await writeFile(filePath, buffer, { flag: "wx" });

      images.push({
        url: `/forum-images/${filename}`,
        alt: cleanAltName(file.name),
        bytes: buffer.byteLength,
        contentType: file.type,
      });
    }

    return NextResponse.json({ images });
  } catch (error) {
    console.error("Error uploading forum images:", error);
    return NextResponse.json({ error: "图片上传失败" }, { status: 500 });
  }
}
