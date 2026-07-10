import { config } from "dotenv";
config();
import { db } from "@/lib/db";
import { createEmbedding } from "@/lib/knowledge/llm-client";
import { saveVectorIndexToFile } from "@/lib/knowledge/vector-store";

const BATCH_SIZE = 10;
const TIMEOUT_MS = 10000;

async function main() {
  const cards = await db.knowledgeCard.findMany({
    where: { archivedAt: null },
    select: { id: true, summary: true, body: true },
  });
  console.log(`Total cards: ${cards.length}`);

  const entries: Array<{ id: string; summary: string; vector: number[] }> = [];
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((c) =>
        createEmbedding({
          input: `${c.summary}\n\n${c.body}`,
          timeoutMs: TIMEOUT_MS,
        }).then((vec) => ({ id: c.id, summary: c.summary, vector: vec })),
      ),
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        entries.push(r.value);
        ok++;
      } else {
        console.warn(`FAIL: ${r.reason}`);
        fail++;
      }
    }

    const pct = (((i + batch.length) / cards.length) * 100).toFixed(1);
    console.log(`Progress: ${i + batch.length}/${cards.length} (${pct}%)  OK:${ok}  FAIL:${fail}`);
  }

  saveVectorIndexToFile(entries);
  console.log(`\nDone. ${entries.length} vectors saved to temp-card-vectors.json`);
  await db.$disconnect();
}

main().catch(console.error);
