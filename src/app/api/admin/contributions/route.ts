import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-utils";
import { formatValidationError } from "@/lib/knowledge/validation";
import { CONTRIBUTION_TYPES } from "@/lib/contribution";

export const dynamic = "force-dynamic";

const awardSchema = z.object({
  userId: z.string().min(1, "缺少用户"),
  points: z.coerce
    .number({ error: "分值必须是数字" })
    .int("分值必须是整数")
    .min(-100000)
    .max(100000)
    .refine((v) => v !== 0, "分值不能为 0"),
  reason: z
    .string({ error: "请填写原因" })
    .trim()
    .min(1, "请填写原因")
    .max(200, "原因过长"),
  type: z.enum(CONTRIBUTION_TYPES).default("OTHER"),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const parsed = awardSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatValidationError(parsed.error) },
        { status: 400 }
      );
    }

    const target = await db.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const event = await db.contributionEvent.create({
      data: {
        userId: parsed.data.userId,
        points: parsed.data.points,
        reason: parsed.data.reason,
        type: parsed.data.type,
        createdById: session.user.id,
      },
    });

    return NextResponse.json({ id: event.id });
  } catch (error) {
    console.error("Error awarding contribution:", error);
    return NextResponse.json({ error: "授予失败" }, { status: 500 });
  }
}
