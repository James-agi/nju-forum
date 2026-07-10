import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-utils";
import { getVisiblePost } from "@/lib/forum/post-visibility";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const { id } = await params;
    const post = await db.post.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, avatar: true, createdAt: true } },
        section: { select: { id: true, name: true, icon: true } },
        tags: { select: { id: true, name: true } },
        _count: { select: { replies: true, favorites: true } },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    }

    return NextResponse.json(getVisiblePost(post, Boolean(session?.user)));
  } catch (error) {
    console.error("Error fetching post:", error);
    return NextResponse.json({ error: "获取帖子失败" }, { status: 500 });
  }
}
