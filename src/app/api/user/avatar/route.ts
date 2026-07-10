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

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_USER_AVATAR_BYTES = 10 * 1024 * 1024;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
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
    const file = formData.get("avatar");
    if (!(file instanceof File)) {
      return fail("请选择要上传的头像");
    }

    if (file.size > MAX_AVATAR_BYTES) {
      return fail("头像不能超过 2MB");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > MAX_AVATAR_BYTES) {
      return fail("头像不能超过 2MB");
    }

    const detected = detectImageType(buffer);
    if (!detected || detected.extension === "gif") {
      return fail("文件内容不是受支持的 jpg/png/webp/avif 图片");
    }

    const namespace = getStorageNamespace(user.id);
    const avatarDir = path.join(process.cwd(), "public", "avatars", namespace);
    await mkdir(avatarDir, { recursive: true });
    try {
      await assertDirectoryQuota(avatarDir, buffer.byteLength, MAX_USER_AVATAR_BYTES);
    } catch (error) {
      return fail(error instanceof Error ? error.message : "上传空间已达到上限", 413);
    }

    const filename = `${Date.now()}-${randomUUID()}.${detected.extension}`;
    const filePath = path.join(avatarDir, filename);
    await writeFile(filePath, buffer, { flag: "wx" });

    const url = `/avatars/${namespace}/${filename}`;
    try {
      await db.user.update({ where: { id: user.id }, data: { avatar: url } });
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }

    const previousPrefix = `/avatars/${namespace}/`;
    if (user.avatar?.startsWith(previousPrefix) && user.avatar !== url) {
      const previousName = user.avatar.slice(previousPrefix.length);
      if (/^[A-Za-z0-9._-]+$/.test(previousName)) {
        await unlink(path.join(avatarDir, previousName)).catch(() => undefined);
      }
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error uploading avatar:", error);
    return NextResponse.json({ error: "头像上传失败" }, { status: 500 });
  }
}
