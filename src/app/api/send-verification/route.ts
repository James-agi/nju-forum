import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/lib/db";

const NJU_DOMAINS = ["@nju.edu.cn", "@smail.nju.edu.cn"];
const SUCCESS_MESSAGE = "验证码已发送";
const IP_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_IP_WINDOW = 5;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const ipBuckets = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawEmail = body.email;

    if (!rawEmail || typeof rawEmail !== "string") {
      return NextResponse.json({ error: "请先填写邮箱" }, { status: 400 });
    }

    const email = rawEmail.trim().toLowerCase();

    if (!NJU_DOMAINS.some((domain) => email.endsWith(domain))) {
      return NextResponse.json(
        { error: "必须使用南大邮箱 (@nju.edu.cn 或 @smail.nju.edu.cn)" },
        { status: 400 }
      );
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

    if (!resend || !process.env.RESEND_FROM) {
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

    const { error: sendError } = await resend.emails.send({
      from: process.env.RESEND_FROM,
      to: email,
      subject: "知南注册验证码",
      html: `<div><p>你的验证码是 <strong>${code}</strong></p><p>10 分钟内有效。</p></div>`,
    });

    if (sendError) {
      console.error("Resend send failed:", sendError);
      await db.verificationCode.deleteMany({ where: { email } });
      return NextResponse.json({ error: "验证码发送失败，请稍后再试" }, { status: 500 });
    }

    return NextResponse.json({ message: SUCCESS_MESSAGE });
  } catch (error) {
    console.error("Send verification error:", error);
    return NextResponse.json({ error: "验证码发送失败，请稍后再试" }, { status: 500 });
  }
}
