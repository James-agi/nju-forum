import { NextResponse } from "next/server";
import { requireKnowledgeAuthor } from "@/lib/knowledge/authz";
import {
  readGptSettings,
  toSettingsDTO,
  writeGptSettings,
} from "@/lib/knowledge/card-batch/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const authz = await requireKnowledgeAuthor();
    if (!authz.ok) return authz.response;

    const settings = await readGptSettings();
    return NextResponse.json({ settings: toSettingsDTO(settings) });
  } catch (error) {
    console.error("Error reading card batch settings:", error);
    return NextResponse.json({ error: "读取 GPT 配置失败" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const authz = await requireKnowledgeAuthor();
    if (!authz.ok) return authz.response;

    const payload = await req.json();
    const settings = await writeGptSettings({
      apiUrl: typeof payload.apiUrl === "string" ? payload.apiUrl : undefined,
      apiKey: typeof payload.apiKey === "string" ? payload.apiKey : undefined,
      model: typeof payload.model === "string" ? payload.model : undefined,
      reviewPrompt:
        typeof payload.reviewPrompt === "string" ? payload.reviewPrompt : undefined,
    });

    return NextResponse.json({ settings: toSettingsDTO(settings) });
  } catch (error) {
    console.error("Error saving card batch settings:", error);
    return NextResponse.json({ error: "保存 GPT 配置失败" }, { status: 500 });
  }
}
