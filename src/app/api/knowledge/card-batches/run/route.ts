import { NextResponse } from "next/server";
import { requireKnowledgeAuthor } from "@/lib/knowledge/authz";
import { startBatchWebRun } from "@/lib/knowledge/card-batch/web-runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const authz = await requireKnowledgeAuthor();
    if (!authz.ok) return authz.response;

    const payload = await req.json();
    const status = await startBatchWebRun(String(payload.batchId || ""));
    return NextResponse.json({ status });
  } catch (error) {
    console.error("Error starting card batch run:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "启动批量运行失败" },
      { status: 400 }
    );
  }
}
