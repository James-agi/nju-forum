import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const favorites = await db.favorite.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        post: {
          include: {
            author: { select: { id: true, name: true } },
            section: { select: { id: true, name: true, icon: true } },
            _count: { select: { replies: true, favorites: true } },
          },
        },
      },
    });

    return NextResponse.json(favorites);
  } catch (error) {
    console.error("Error fetching user favorites:", error);
    return NextResponse.json({ error: "获取收藏失败" }, { status: 500 });
  }
}
