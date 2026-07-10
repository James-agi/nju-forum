import { NextResponse } from "next/server";
import { requireKnowledgeAuthor } from "@/lib/knowledge/authz";
import { createJobFollowup } from "@/lib/knowledge/card-batch/storage";
import { startFollowupWebRun } from "@/lib/knowledge/card-batch/web-runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const authz = await requireKnowledgeAuthor();
    if (!authz.ok) return authz.response;

    const payload = await req.json();
    const result = await createJobFollowup({
      batchId: String(payload.batchId || ""),
      jobId: String(payload.jobId || ""),
      prompt: String(payload.prompt || ""),
    });

    const runStatus =
      payload.runNow === true
        ? await startFollowupWebRun({
            batchId: result.batchId,
            jobId: result.jobId,
            promptPath: result.promptPath,
          })
        : null;

    return NextResponse.json({ ...result, runStatus });
  } catch (error) {
    console.error("Error creating card batch followup:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "追加 Prompt 失败" },
      { status: 400 }
    );
  }
}
