import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { refreshAllPostMetrics } from "@/lib/forum/post-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearerToken(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");

  if (scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function hasValidCronToken(provided: string | null, expected: string) {
  if (!provided) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "Cron secret is not configured." },
      { status: 503 }
    );
  }

  if (!hasValidCronToken(getBearerToken(req), cronSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const startedAt = Date.now();
    await refreshAllPostMetrics();

    return NextResponse.json({
      ok: true,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("[cron] refresh post metrics failed:", error);
    return NextResponse.json(
      { error: "Failed to refresh post metrics." },
      { status: 500 }
    );
  }
}
