import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-utils";
import {
  encodePostContent,
  normalizePostContentFormat,
} from "@/lib/forum/content-format";
import { recomputePostMetrics } from "@/lib/forum/post-metrics";

const MAX_REPLY_IMAGES = 6;
const MAX_REPLY_LENGTH = 20_000;
const MAX_ID_LENGTH = 64;
const FORUM_IMAGE_PATTERN = /^\/forum-images\/[A-Za-z0-9._~/%-]+$/;

function normalizeImages(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(new Set(value))
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => FORUM_IMAGE_PATTERN.test(item))
    .slice(0, MAX_REPLY_IMAGES);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const replies = await db.reply.findMany({
      where: { postId: id, parentId: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        children: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: {
            author: { select: { id: true, name: true, avatar: true } },
            children: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              include: {
                author: { select: { id: true, name: true, avatar: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(replies);
  } catch (error) {
    console.error("Error fetching replies:", error);
    return NextResponse.json({ error: "获取回复失败" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.banned) {
      return NextResponse.json({ error: "账号已被封禁" }, { status: 403 });
    }

    const payload = await req.json();
    const content = typeof payload?.content === "string" ? payload.content : "";
    const parentId = typeof payload?.parentId === "string" ? payload.parentId : null;
    const contentFormat = normalizePostContentFormat(payload?.contentFormat);
    const images = contentFormat === "plain" ? normalizeImages(payload?.images) : [];

    if (!content?.trim() && images.length === 0) {
      return NextResponse.json({ error: "请输入回复内容或添加图片" }, { status: 400 });
    }


    if (content.length > MAX_REPLY_LENGTH || id.length > MAX_ID_LENGTH || (parentId?.length ?? 0) > MAX_ID_LENGTH) {
      return NextResponse.json({ error: "回复内容或参数过长" }, { status: 400 });
    }

    const post = await db.post.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    }

    if (parentId) {
      const parentReply = await db.reply.findUnique({ where: { id: parentId } });
      if (!parentReply || parentReply.postId !== id) {
        return NextResponse.json({ error: "父回复不存在" }, { status: 400 });
      }
    }

    const reply = await db.reply.create({
      data: {
        content: encodePostContent(content.trim(), contentFormat),
        images,
        authorId: session.user.id,
        postId: id,
        parentId,
      },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    });

    await db.post.update({
      where: { id },
      data: { replyCount: { increment: 1 } },
    });
    await recomputePostMetrics(id);

    return NextResponse.json(reply);
  } catch (error) {
    console.error("Error creating reply:", error);
    return NextResponse.json({ error: "回复失败" }, { status: 500 });
  }
}
