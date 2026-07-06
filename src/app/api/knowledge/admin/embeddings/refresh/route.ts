import { NextResponse } from "next/server";
import { requireKnowledgeAuthor } from "@/lib/knowledge/authz";
import { refreshAllEmbeddingsToFile } from "@/lib/knowledge/embedding-refresh";

export const dynamic = "force-dynamic";

export async function POST() {
  const authz = await requireKnowledgeAuthor();
  if (!authz.ok) return authz.response;

  try {
    const count = await refreshAllEmbeddingsToFile();
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    console.error("Error refreshing embeddings:", error);
    return NextResponse.json({ error: "向量刷新失败" }, { status: 500 });
  }
}
