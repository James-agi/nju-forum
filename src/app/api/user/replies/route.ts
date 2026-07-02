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

    const replies = await db.reply.findMany({
      where: { authorId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        post: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(replies);
  } catch (error) {
    console.error("Error fetching user replies:", error);
    return NextResponse.json({ error: "获取回复失败" }, { status: 500 });
  }
}
