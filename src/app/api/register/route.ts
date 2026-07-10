import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 128;

class InvalidVerificationCodeError extends Error {}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { password, verificationCode } = body;
    const rawEmail = body.email;
    const rawName = body.name;

    if (!rawEmail || typeof rawEmail !== "string" || !rawName || typeof rawName !== "string" || !password || typeof password !== "string" || !verificationCode || typeof verificationCode !== "string") {
      return NextResponse.json({ error: "请填写所有字段" }, { status: 400 });
    }

    const email = rawEmail.trim().toLowerCase();
    const name = rawName.trim();

    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
    }

    if (name.length < 2 || name.length > 20) {
      return NextResponse.json({ error: "昵称长度需在 2-20 字符之间" }, { status: 400 });
    }

    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json({ error: "密码长度需为 10-128 位" }, { status: 400 });
    }

    const record = await db.verificationCode.findFirst({
      where: {
        email,
        used: false,
        expiresAt: { gt: new Date() },
        attempts: { lt: 5 },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      return NextResponse.json({ error: "验证码错误或已过期" }, { status: 400 });
    }

    if (record.code !== verificationCode.trim()) {
      const newAttempts = record.attempts + 1;
      await db.verificationCode.updateMany({
        where: { id: record.id, used: false, attempts: record.attempts },
        data: {
          attempts: { increment: 1 },
          ...(newAttempts >= 5 ? { used: true } : {}),
        },
      });
      return NextResponse.json({ error: "验证码错误或已过期" }, { status: 400 });
    }

    const hashedPassword = await hash(password, 12);

    const user = await db.$transaction(async (tx) => {
      const claimed = await tx.verificationCode.updateMany({
        where: {
          id: record.id,
          email,
          code: verificationCode.trim(),
          used: false,
          expiresAt: { gt: new Date() },
          attempts: { lt: 5 },
        },
        data: { used: true },
      });
      if (claimed.count !== 1) throw new InvalidVerificationCodeError();

      return tx.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
        },
      });
    });

    return NextResponse.json({
      message: "注册成功",
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    if (error instanceof InvalidVerificationCodeError || (error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "验证码错误、已过期或邮箱不可用" }, { status: 400 });
    }
    console.error("Registration error:", error);
    return NextResponse.json({ error: "注册失败，请稍后再试" }, { status: 500 });
  }
}
