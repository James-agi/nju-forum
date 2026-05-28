import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-utils";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const replies = await db.reply.findMany({
      where: { postId: params.id, parentId: null },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        children: {
          include: {
            author: { select: { id: true, name: true, avatar: true } },
            children: {
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
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.banned) {
      return NextResponse.json({ error: "账号已被封禁" }, { status: 403 });
    }

    const { content, parentId } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: "回复内容不能为空" }, { status: 400 });
    }

    const post = await db.post.findUnique({ where: { id: params.id } });
    if (!post) {
      return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    }

    if (parentId) {
      const parentReply = await db.reply.findUnique({ where: { id: parentId } });
      if (!parentReply || parentReply.postId !== params.id) {
        return NextResponse.json({ error: "父回复不存在" }, { status: 400 });
      }
    }

    const reply = await db.reply.create({
      data: {
        content: content.trim(),
        authorId: session.user.id,
        postId: params.id,
        parentId: parentId || null,
      },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    });

    await db.post.update({
      where: { id: params.id },
      data: { replyCount: { increment: 1 } },
    });

    return NextResponse.json(reply);
  } catch (error) {
    console.error("Error creating reply:", error);
    return NextResponse.json({ error: "回复失败" }, { status: 500 });
  }
}
