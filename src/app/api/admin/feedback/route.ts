import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

const MAX_REPLY_LENGTH = 2000;

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const { id, archived, replyContent } = await req.json();
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "缺少反馈 ID" }, { status: 400 });
    }

    const data: {
      archivedAt?: Date | null;
      replyContent?: string;
      repliedAt?: Date;
      repliedById?: string;
    } = {};

    if (typeof archived === "boolean") {
      data.archivedAt = archived === false ? null : new Date();
    }

    if (replyContent !== undefined) {
      if (typeof replyContent !== "string") {
        return NextResponse.json({ error: "回复内容无效" }, { status: 400 });
      }

      const normalizedReply = replyContent.trim();
      if (!normalizedReply) {
        return NextResponse.json({ error: "请填写回复内容" }, { status: 400 });
      }

      if (normalizedReply.length > MAX_REPLY_LENGTH) {
        return NextResponse.json(
          { error: `回复内容过长，最多 ${MAX_REPLY_LENGTH} 字` },
          { status: 400 }
        );
      }

      data.replyContent = normalizedReply;
      data.repliedAt = new Date();
      data.repliedById = session.user.id;
      if (archived === undefined) {
        data.archivedAt = new Date();
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "没有可更新的内容" }, { status: 400 });
    }

    await db.websiteFeedback.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating feedback:", error);
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
