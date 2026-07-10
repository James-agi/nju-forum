import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-utils";
import { detectImageType } from "@/lib/security/file-signatures";
import { assertDirectoryQuota, getStorageNamespace } from "@/lib/security/storage-quota";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 18 * 1024 * 1024;
const MAX_USER_IMAGE_BYTES = 100 * 1024 * 1024;
const MAX_UPLOAD_IMAGES = 6;

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

    const namespace = getStorageNamespace(user.id);
    const imageDir = path.join(process.cwd(), "public", "forum-images", namespace);
    await mkdir(imageDir, { recursive: true });

    const validatedImages = [];
    let totalBytes = 0;

    for (const file of files) {
      if (file.size > MAX_IMAGE_BYTES) {
        return fail("单张图片不能超过 5MB");
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.byteLength > MAX_IMAGE_BYTES) {
        return fail("单张图片不能超过 5MB");
      }

      const detected = detectImageType(buffer);
      if (!detected) {
        return fail("文件内容不是受支持的 jpg/png/webp/gif/avif 图片");
      }

      totalBytes += buffer.byteLength;
      if (totalBytes > MAX_UPLOAD_BYTES) {
        return fail("单次上传图片总大小不能超过 18MB");
      }

      validatedImages.push({ file, buffer, detected });
    }

    try {
      await assertDirectoryQuota(imageDir, totalBytes, MAX_USER_IMAGE_BYTES);
    } catch (error) {
      return fail(error instanceof Error ? error.message : "上传空间已达到上限", 413);
    }

    const images = [];
    const writtenPaths: string[] = [];
    try {
      for (const { file, buffer, detected } of validatedImages) {
        const filename = `${Date.now()}-${randomUUID()}.${detected.extension}`;
        const filePath = path.join(imageDir, filename);
        await writeFile(filePath, buffer, { flag: "wx" });
        writtenPaths.push(filePath);

        images.push({
          url: `/forum-images/${namespace}/${filename}`,
          alt: cleanAltName(file.name),
          bytes: buffer.byteLength,
          contentType: detected.contentType,
        });
      }
    } catch (error) {
      await Promise.allSettled(writtenPaths.map((filePath) => unlink(filePath)));
      throw error;
    }

    return NextResponse.json({ images });
  } catch (error) {
    console.error("Error uploading forum images:", error);
    return NextResponse.json({ error: "图片上传失败" }, { status: 500 });
  }
}
