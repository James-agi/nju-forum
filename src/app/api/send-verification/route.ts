import { randomInt } from "crypto";
import { Message, SMTPClient } from "emailjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTrustedClientIp } from "@/lib/security/request-policy";

export const runtime = "nodejs";

const SUCCESS_MESSAGE = "验证码已发送";
const IP_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_IP_WINDOW = 5;
const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEADER_LINE_BREAK_PATTERN = /[\r\n]/;

function getMailConfig() {
  const host = process.env.ALIYUN_SMTP_HOST || "smtpdm.aliyun.com";
  const port = Number(process.env.ALIYUN_SMTP_PORT || "465");
  const user = process.env.ALIYUN_SMTP_USER;
  const pass = process.env.ALIYUN_SMTP_PASS;
  const from = process.env.ALIYUN_SMTP_FROM;

  if (
    !host ||
    !Number.isInteger(port) ||
    port <= 0 ||
    port > 65_535 ||
    !user ||
    !pass ||
    !from ||
    HEADER_LINE_BREAK_PATTERN.test(from) ||
    HEADER_LINE_BREAK_PATTERN.test(user)
  ) {
    return null;
  }

  return { host, port, user, pass, from };
}

async function sendVerificationEmail({
  email,
  code,
  mailConfig,
}: {
  email: string;
  code: string;
  mailConfig: NonNullable<ReturnType<typeof getMailConfig>>;
}) {
  const client = new SMTPClient({
    host: mailConfig.host,
    port: mailConfig.port,
    user: mailConfig.user,
    password: mailConfig.pass,
    ssl: mailConfig.port === 465,
    tls: mailConfig.port !== 465,
    timeout: 10_000,
    authentication: ["PLAIN", "LOGIN"],
  });

  try {
    const message = new Message({
      from: mailConfig.from,
      to: email,
      subject: "知南注册验证码",
      text: `你的验证码是 ${code}\n10 分钟内有效。`,
      attachment: [
        {
          data: `<div><p>你的验证码是 <strong>${code}</strong></p><p>10 分钟内有效。</p></div>`,
          alternative: true,
          type: "text/html",
          charset: "utf-8",
        },
      ],
    });

    const { isValid, validationError } = message.checkValidity();
    if (!isValid) {
      throw new Error(validationError || "Invalid verification email");
    }

    await client.sendAsync(message);
  } finally {
    client.smtp.close();
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawEmail = body.email;

    if (!rawEmail || typeof rawEmail !== "string") {
      return NextResponse.json({ error: "请先填写邮箱" }, { status: 400 });
    }

    const email = rawEmail.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
    }

    const clientIp = getTrustedClientIp(req.headers);
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

    try {
      await sendVerificationEmail({
        email,
        code,
        mailConfig,
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
