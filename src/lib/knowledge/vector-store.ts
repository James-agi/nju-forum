import { db } from "@/lib/db";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { SEMANTIC_TOP_K } from "@/lib/knowledge/config";

export interface SemanticResult {
  cardId: string;
  similarity: number;
}

// ---- pgvector path ----

async function searchPgvector(queryVector: number[], topK: number): Promise<SemanticResult[]> {
  try {
    const vectorStr = `[${queryVector.join(",")}]`;
    const rows: Array<{ id: string; similarity: number }> = await db.$queryRawUnsafe(
      `SELECT id, 1 - ("embedding" <=> $1::vector) AS similarity
       FROM "KnowledgeCard"
       WHERE "embedding" IS NOT NULL AND "archivedAt" IS NULL
       ORDER BY "embedding" <=> $1::vector
       LIMIT $2`,
      vectorStr,
      topK,
    );
    return rows.map((r) => ({ cardId: r.id, similarity: r.similarity }));
  } catch {
    return [];
  }
}

export async function upsertCardEmbedding(cardId: string, vector: number[]): Promise<void> {
  try {
    const vectorStr = `[${vector.join(",")}]`;
    await db.$executeRawUnsafe(
      `UPDATE "KnowledgeCard" SET "embedding" = $1::vector WHERE id = $2`,
      vectorStr,
      cardId,
    );
  } catch (err) {
    console.warn("[vector-store] upsertCardEmbedding failed:", err);
  }
}

export async function hasVectors(): Promise<boolean> {
  try {
    const rows: Array<{ count: bigint }> = await db.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "KnowledgeCard" WHERE "embedding" IS NOT NULL AND "archivedAt" IS NULL`,
    );
    return Number(rows[0]?.count ?? 0) > 0;
  } catch {
    return fileFallbackHasVectors();
  }
}

// ---- file fallback (legacy) ----

export interface VectorEntry {
  id: string;
  summary: string;
  vector: number[];
}

let vectorIndex: VectorEntry[] | null = null;

function loadFileVectors(): VectorEntry[] {
  if (vectorIndex) return vectorIndex;

  const vectorPath = path.resolve(process.cwd(), "temp-card-vectors.json");
  if (!existsSync(vectorPath)) {
    vectorIndex = [];
    return vectorIndex;
  }

  try {
    const raw = readFileSync(vectorPath, "utf8");
    vectorIndex = JSON.parse(raw) as VectorEntry[];
  } catch {
    vectorIndex = [];
  }
  return vectorIndex;
}

export function ensureVectorIndexLoaded(): VectorEntry[] {
  return loadFileVectors();
}

export function saveVectorIndexToFile(entries: VectorEntry[]): void {
  const vectorPath = path.resolve(process.cwd(), "temp-card-vectors.json");
  writeFileSync(vectorPath, JSON.stringify(entries), "utf8");
  vectorIndex = entries;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

function fileFallbackHasVectors(): boolean {
  return loadFileVectors().length > 0;
}

function searchFileFallback(queryVector: number[], topK: number): SemanticResult[] {
  const entries = loadFileVectors();
  if (entries.length === 0) return [];

  const scored = entries.map((entry) => ({
    cardId: entry.id,
    similarity: cosineSimilarity(queryVector, entry.vector),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}

// ---- unified API ----

export async function semanticSearch(queryVector: number[], topK = SEMANTIC_TOP_K): Promise<SemanticResult[]> {
  const pgResults = await searchPgvector(queryVector, topK);
  if (pgResults.length > 0) return pgResults;

  return searchFileFallback(queryVector, topK);
}

export function getVectorForCard(cardId: string): number[] | null {
  // pgvector: we'd query directly, but for now fallback to file
  const entries = loadFileVectors();
  const entry = entries.find((e) => e.id === cardId);
  return entry?.vector ?? null;
}
