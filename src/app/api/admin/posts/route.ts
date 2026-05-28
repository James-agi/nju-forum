import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-utils";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const posts = await db.post.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true } },
        section: { select: { id: true, name: true, icon: true } },
      },
    });

    return NextResponse.json(posts);
  } catch (error) {
    console.error("Error fetching admin posts:", error);
    return NextResponse.json({ error: "获取帖子失败" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const { id, pinned } = await req.json();

    await db.post.update({
      where: { id },
      data: { pinned },
    });

    return NextResponse.json({ message: "操作成功" });
  } catch (error) {
    console.error("Error updating post:", error);
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const { id } = await req.json();

    await db.reply.deleteMany({ where: { postId: id } });
    await db.favorite.deleteMany({ where: { postId: id } });
    await db.post.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("Error deleting post:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
