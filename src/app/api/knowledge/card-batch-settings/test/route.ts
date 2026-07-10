import { NextResponse } from "next/server";
import { requireKnowledgeAuthor } from "@/lib/knowledge/authz";
import { readGptSettings } from "@/lib/knowledge/card-batch/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const authz = await requireKnowledgeAuthor();
    if (!authz.ok) return authz.response;

    const payload = await req.json();
    const saved = await readGptSettings();
    const apiUrl =
      typeof payload.apiUrl === "string" && payload.apiUrl.trim()
        ? payload.apiUrl.trim()
        : saved.apiUrl;
    const apiKey =
      typeof payload.apiKey === "string" && payload.apiKey.trim()
        ? payload.apiKey.trim()
        : saved.apiKey;
    const model =
      typeof payload.model === "string" && payload.model.trim()
        ? payload.model.trim()
        : saved.model;

    if (!apiUrl) {
      return NextResponse.json({ error: "缺少 GPT API URL" }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ error: "缺少 GPT API Key" }, { status: 400 });
    }
    if (!model) {
      return NextResponse.json({ error: "缺少 GPT 模型名" }, { status: 400 });
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 32,
        messages: [
          {
            role: "system",
            content: "你是连接测试助手。",
          },
          {
            role: "user",
            content: "请只回复：OK",
          },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `GPT 测试失败：${response.status} ${await response.text()}` },
        { status: 400 }
      );
    }

    const raw = await response.text();
    let data: {
      choices?: Array<{
        message?: { content?: string };
        text?: string;
      }>;
    };
    try {
      data = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        {
          error: `GPT API 返回的不是 JSON。请检查 API URL 是否是 chat completions 接口，例如 /v1/chat/completions。返回开头：${raw.slice(
            0,
            120
          )}`,
        },
        { status: 400 }
      );
    }

    const message =
      data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";

    return NextResponse.json({
      ok: true,
      message: typeof message === "string" ? message.slice(0, 200) : "",
    });
  } catch (error) {
    console.error("Error testing GPT settings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "GPT 连接测试失败" },
      { status: 400 }
    );
  }
}
