import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireKnowledgeAuthor } from "@/lib/knowledge/authz";
import { readCardBatch } from "@/lib/knowledge/card-batch/storage";
import { readWebRunStatus } from "@/lib/knowledge/card-batch/web-runner";
import { repairCardsJson } from "@/lib/knowledge/card-batch/json-repair";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function readOptionalText(file: string) {
  if (!existsSync(file)) return null;
  return readFile(file, "utf8");
}

async function readOptionalJson(file: string) {
  if (!existsSync(file)) return null;
  const raw = await readFile(file, "utf8");
  const { repaired } = repairCardsJson(raw);
  return JSON.parse(repaired);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authz = await requireKnowledgeAuthor();
    if (!authz.ok) return authz.response;

    const { id } = await params;
    const batch = await readCardBatch(decodeURIComponent(id));
    const runStatus = await readWebRunStatus(batch.id);
    const jobs = await Promise.all(
      batch.jobs.map(async (job) => ({
        ...job,
        cards: await readOptionalJson(path.join(job.directory, "cards.json")),
        iteration: await readOptionalText(path.join(job.directory, "iteration.md")),
        gptReview: await readOptionalText(path.join(job.directory, "gpt-review.md")),
        runnerValidation: await readOptionalJson(
          path.join(job.directory, "runner-validation.json")
        ),
      }))
    );
    const allCards = await readOptionalJson(
      path.join(batch.rootDirectory, "exports", "all-cards.json")
    );
    const reviewReport = await readOptionalText(
      path.join(batch.rootDirectory, "exports", "review-report.md")
    );

    return NextResponse.json({
      batch: { ...batch, jobs },
      runStatus,
      allCards,
      reviewReport,
    });
  } catch (error) {
    console.error("Error reading card batch detail:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取批次详情失败" },
      { status: 400 }
    );
  }
}
