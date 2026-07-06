import { createEmbedding as llmCreateEmbedding } from "@/lib/knowledge/llm-client";
import { EMBEDDING_TIMEOUT } from "@/lib/knowledge/config";

export async function embedQuery(text: string): Promise<number[] | null> {
  try {
    return await llmCreateEmbedding({ input: text, timeoutMs: EMBEDDING_TIMEOUT });
  } catch {
    return null;
  }
}
