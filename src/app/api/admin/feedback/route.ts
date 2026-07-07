import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const { id, archived } = await req.json();
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "缺少反馈 ID" }, { status: 400 });
    }

    await db.websiteFeedback.update({
      where: { id },
      data: { archivedAt: archived === false ? null : new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating feedback:", error);
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
