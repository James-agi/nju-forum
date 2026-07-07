import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

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

    const extension = ALLOWED_IMAGE_TYPES.get(file.type);
    if (!extension) {
      return fail("只支持 jpg/png/webp/avif 图片");
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return fail("头像不能超过 2MB");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > MAX_AVATAR_BYTES) {
      return fail("头像不能超过 2MB");
    }

    const avatarDir = path.join(process.cwd(), "public", "avatars");
    await mkdir(avatarDir, { recursive: true });

    const filename = `${Date.now()}-${randomUUID()}.${extension}`;
    const filePath = path.join(avatarDir, filename);
    await writeFile(filePath, buffer, { flag: "wx" });

    const url = `/avatars/${filename}`;
    await db.user.update({ where: { id: user.id }, data: { avatar: url } });

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error uploading avatar:", error);
    return NextResponse.json({ error: "头像上传失败" }, { status: 500 });
  }
}
