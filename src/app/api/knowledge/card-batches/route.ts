import { NextResponse } from "next/server";
import { requireKnowledgeAuthor } from "@/lib/knowledge/authz";
import {
  buildRunnerCommand,
  createCardBatch,
  listCardBatches,
} from "@/lib/knowledge/card-batch/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const authz = await requireKnowledgeAuthor();
    if (!authz.ok) return authz.response;

    const batches = await listCardBatches();
    return NextResponse.json({ batches });
  } catch (error) {
    console.error("Error listing card batches:", error);
    return NextResponse.json({ error: "获取批量任务失败" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authz = await requireKnowledgeAuthor();
    if (!authz.ok) return authz.response;

    const payload = await req.json();
    const batch = await createCardBatch(payload);

    return NextResponse.json({
      batch,
      runnerCommand: buildRunnerCommand(batch),
    });
  } catch (error) {
    console.error("Error creating card batch:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建批量任务失败" },
      { status: 400 }
    );
  }
}
