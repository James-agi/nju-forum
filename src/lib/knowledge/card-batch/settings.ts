import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type {
  CardBatchGptSettings,
  CardBatchGptSettingsDTO,
} from "./types";

const workflowRoot = path.join(process.cwd(), "agent-workflows", "card-batch");
const settingsPath = path.join(workflowRoot, "settings.local.json");

const defaultReviewPrompt =
  "请以南京大学新生用户视角审查这些知识卡片：看完是否能直接解决问题？是否缺步骤、缺时机建议、缺踩坑提醒、语气是否太像通知？请输出具体修改建议，最后给出可直接追加给 opencode 的二轮迭代 prompt。";

export const DEFAULT_GPT_SETTINGS: CardBatchGptSettings = {
  apiUrl: "https://api.openai.com/v1/chat/completions",
  apiKey: "",
  model: "gpt-4o-mini",
  reviewPrompt: defaultReviewPrompt,
};

export function getSettingsPath() {
  return settingsPath;
}

export function toSettingsDTO(settings: CardBatchGptSettings): CardBatchGptSettingsDTO {
  return {
    apiUrl: settings.apiUrl,
    model: settings.model,
    reviewPrompt: settings.reviewPrompt,
    hasApiKey: Boolean(settings.apiKey?.trim()),
  };
}

export async function readGptSettings(): Promise<CardBatchGptSettings> {
  if (!existsSync(settingsPath)) {
    return { ...DEFAULT_GPT_SETTINGS };
  }

  const raw = await readFile(settingsPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<CardBatchGptSettings>;

  return {
    apiUrl: parsed.apiUrl || DEFAULT_GPT_SETTINGS.apiUrl,
    apiKey: parsed.apiKey || "",
    model: parsed.model || DEFAULT_GPT_SETTINGS.model,
    reviewPrompt: parsed.reviewPrompt || DEFAULT_GPT_SETTINGS.reviewPrompt,
  };
}

export async function writeGptSettings(input: Partial<CardBatchGptSettings>) {
  const current = await readGptSettings();
  const next: CardBatchGptSettings = {
    apiUrl: input.apiUrl?.trim() || current.apiUrl,
    apiKey:
      typeof input.apiKey === "string" && input.apiKey.trim()
        ? input.apiKey.trim()
        : current.apiKey,
    model: input.model?.trim() || current.model,
    reviewPrompt: input.reviewPrompt?.trim() || current.reviewPrompt,
  };

  await mkdir(workflowRoot, { recursive: true });
  await persistSettings(next);
  return next;
}

async function persistSettings(
  gptSettings: CardBatchGptSettings,
  extra?: { opencodePort?: number },
) {
  let existing: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try {
      existing = JSON.parse(await readFile(settingsPath, "utf8"));
    } catch {
      /* ignore parse errors */
    }
  }
  const merged = {
    ...existing,
    apiUrl: gptSettings.apiUrl,
    apiKey: gptSettings.apiKey,
    model: gptSettings.model,
    reviewPrompt: gptSettings.reviewPrompt,
    opencodePort:
      extra?.opencodePort !== undefined ? extra.opencodePort : existing.opencodePort ?? 0,
  };
  await writeFile(settingsPath, JSON.stringify(merged, null, 2), "utf8");
}

export async function readOpencodePort(): Promise<number> {
  if (!existsSync(settingsPath)) return 0;
  try {
    const raw = await readFile(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as { opencodePort?: number };
    return parsed.opencodePort && parsed.opencodePort > 0 ? parsed.opencodePort : 0;
  } catch {
    return 0;
  }
}

export async function writeOpencodePort(port: number): Promise<void> {
  const current = await readGptSettings();
  await persistSettings(current, { opencodePort: port });
}
