import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-utils";
import { websiteFeedbackSchema } from "@/lib/feedback/validation";
import { formatValidationError } from "@/lib/knowledge/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.banned) {
      return NextResponse.json({ error: "账号已被封禁" }, { status: 403 });
    }

    const payload = await req.json();
    const parsed = websiteFeedbackSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatValidationError(parsed.error) },
        { status: 400 }
      );
    }

    const feedback = await db.websiteFeedback.create({
      data: {
        userId: user.id,
        category: parsed.data.category,
        content: parsed.data.content,
        contact: parsed.data.contact ?? null,
      },
    });

    return NextResponse.json({ id: feedback.id });
  } catch (error) {
    console.error("Error creating feedback:", error);
    return NextResponse.json({ error: "提交反馈失败" }, { status: 500 });
  }
}
