import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const SUCCESS_MESSAGE = "验证码已发送";
const IP_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_IP_WINDOW = 5;
const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getMailConfig() {
  const host = process.env.ALIYUN_SMTP_HOST || "smtpdm.aliyun.com";
  const port = Number(process.env.ALIYUN_SMTP_PORT || "465");
  const user = process.env.ALIYUN_SMTP_USER;
  const pass = process.env.ALIYUN_SMTP_PASS;
  const from = process.env.ALIYUN_SMTP_FROM;

  if (!host || !Number.isInteger(port) || !user || !pass || !from) {
    return null;
  }

  return { host, port, user, pass, from };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawEmail = body.email;

    if (!rawEmail || typeof rawEmail !== "string") {
      return NextResponse.json({ error: "请先填写邮箱" }, { status: 400 });
    }

    const email = rawEmail.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
    }

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const now = Date.now();
    const bucket = ipBuckets.get(clientIp);

    if (!bucket || bucket.resetAt <= now) {
      ipBuckets.set(clientIp, { count: 1, resetAt: now + IP_WINDOW_MS });
    } else if (bucket.count >= MAX_REQUESTS_PER_IP_WINDOW) {
      return NextResponse.json({ error: "发送过于频繁，请稍后再试" }, { status: 429 });
    } else {
      bucket.count += 1;
    }

    if (ipBuckets.size > 10_000) {
      ipBuckets.forEach((entry, ip) => {
        if (entry.resetAt <= now) ipBuckets.delete(ip);
      });
    }

    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json({ message: SUCCESS_MESSAGE });
    }

    const mailConfig = getMailConfig();

    if (!mailConfig) {
      return NextResponse.json({ error: "邮件服务未配置" }, { status: 500 });
    }

    const latest = await db.verificationCode.findFirst({
      where: { email },
      orderBy: { createdAt: "desc" },
    });

    if (latest && Date.now() - latest.createdAt.getTime() < 60_000) {
      return NextResponse.json({ error: "发送过于频繁，请稍后再试" }, { status: 429 });
    }

    await db.verificationCode.deleteMany({ where: { email } });

    const code = String(randomInt(100000, 1000000));
    await db.verificationCode.create({
      data: {
        email,
        code,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });

    const transporter = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.port === 465,
      auth: {
        user: mailConfig.user,
        pass: mailConfig.pass,
      },
    });

    try {
      await transporter.sendMail({
        from: mailConfig.from,
        to: email,
        subject: "知南注册验证码",
        text: `你的验证码是 ${code}\n10 分钟内有效。`,
        html: `<div><p>你的验证码是 <strong>${code}</strong></p><p>10 分钟内有效。</p></div>`,
      });
    } catch (sendError) {
      console.error("Aliyun SMTP send failed:", sendError);
      await db.verificationCode.deleteMany({ where: { email } });
      return NextResponse.json({ error: "验证码发送失败，请稍后再试" }, { status: 500 });
    }

    return NextResponse.json({ message: SUCCESS_MESSAGE });
  } catch (error) {
    console.error("Send verification error:", error);
    return NextResponse.json({ error: "验证码发送失败，请稍后再试" }, { status: 500 });
  }
}
