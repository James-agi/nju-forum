import { db } from "@/lib/db";
import { createEmbedding } from "@/lib/knowledge/llm-client";
import {
  upsertCardEmbedding,
  saveVectorIndexToFile,
  ensureVectorIndexLoaded,
} from "@/lib/knowledge/vector-store";
import type { VectorEntry } from "@/lib/knowledge/vector-store";
import { EMBEDDING_TIMEOUT, EMBEDDING_CONCURRENCY } from "@/lib/knowledge/config";

class Semaphore {
  private current = 0;
  private queue: Array<() => void> = [];
  constructor(private max: number) {}
  async acquire(): Promise<void> {
    if (this.current < this.max) { this.current++; return; }
    return new Promise<void>((r) => this.queue.push(r));
  }
  release(): void {
    const next = this.queue.shift();
    if (next) process.nextTick(next); else this.current--;
  }
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try { return await fn(); }
    finally { this.release(); }
  }
}

const embeddingSemaphore = new Semaphore(EMBEDDING_CONCURRENCY);

function buildEmbeddingText(summary: string, body: string, domainTag: string): string {
  return `${domainTag}: ${summary}\n\n${body}`;
}

function patchVectorIndex(cardId: string, summary: string, vector: number[]): void {
  const entries = ensureVectorIndexLoaded();
  const idx = entries.findIndex((e) => e.id === cardId);
  const entry: VectorEntry = { id: cardId, summary, vector };
  if (idx === -1) {
    entries.push(entry);
  } else {
    entries[idx] = entry;
  }
  saveVectorIndexToFile(entries);
}

export async function computeAndStoreEmbedding(
  cardId: string,
  summary: string,
  body: string,
  domainTag: string,
): Promise<void> {
  try {
    const input = buildEmbeddingText(summary, body, domainTag);
    const vector = await embeddingSemaphore.run(() =>
      createEmbedding({ input, timeoutMs: EMBEDDING_TIMEOUT }),
    );
    if (vector) {
      await upsertCardEmbedding(cardId, vector);
      patchVectorIndex(cardId, summary, vector);
    }
  } catch (err) {
    console.warn("[embedding-refresh] compute failed:", err);
  }
}

export async function refreshNullEmbeddings(batchSize = 50): Promise<number> {
  const cards = await db.knowledgeCard.findMany({
    where: {
      archivedAt: null,
    },
    take: batchSize,
    select: { id: true, summary: true, body: true, domainTag: true },
  });

  let updated = 0;
  for (const card of cards) {
    try {
      await computeAndStoreEmbedding(card.id, card.summary, card.body, card.domainTag);
      updated++;
    } catch {
      // continue with next card
    }
  }
  return updated;
}

export async function refreshAllEmbeddingsToFile(): Promise<number> {
  const cards = await db.knowledgeCard.findMany({
    where: { archivedAt: null },
    select: { id: true, summary: true, body: true, domainTag: true },
  });

  const entries: VectorEntry[] = [];
  await Promise.all(cards.map(async (card) => {
    try {
      const input = buildEmbeddingText(card.summary, card.body, card.domainTag);
      const vector = await embeddingSemaphore.run(() =>
        createEmbedding({ input, timeoutMs: EMBEDDING_TIMEOUT }),
      );
      if (vector) {
        entries.push({ id: card.id, summary: card.summary, vector });
        await upsertCardEmbedding(card.id, vector).catch(() => {});
      }
    } catch (err) {
      console.warn(`[embedding-refresh] failed for card ${card.id}:`, err);
    }
  }));

  saveVectorIndexToFile(entries);
  return entries.length;
}
