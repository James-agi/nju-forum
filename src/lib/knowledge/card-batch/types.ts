export const CARD_BATCH_PHASES = [
  "read_prompt_file",
  "submit_url",
  "compare_source",
] as const;

export type CardBatchPhase = (typeof CARD_BATCH_PHASES)[number];

export const CARD_BATCH_PHASE_LABELS: Record<CardBatchPhase, string> = {
  read_prompt_file: "第 1 轮：读取规范",
  submit_url: "第 2 轮：输入 URL",
  compare_source: "第 3 轮：原文比对",
};

export interface CardBatchPromptHook {
  id: string;
  title: string;
  phase: CardBatchPhase;
  enabled: boolean;
  order: number;
  content: string;
}

export interface CardBatchGptSettings {
  apiUrl: string;
  apiKey?: string;
  model: string;
  reviewPrompt: string;
}

export interface CardBatchGptSettingsDTO {
  apiUrl: string;
  model: string;
  reviewPrompt: string;
  hasApiKey: boolean;
}

export interface CardBatchSourceInput {
  url: string;
  title?: string;
}

export interface CardBatchJob {
  id: string;
  source: CardBatchSourceInput;
  slug: string;
  directory: string;
  promptSequencePath: string;
  stagePromptPaths: string[];
  status: "SCAFFOLDED" | "RUNNING" | "EXPORTED" | "FAILED" | "DONE";
  /** ISO timestamp of last followup execution */
  lastFollowupAt?: string;
  /** Total followup prompts processed */
  followupCount?: number;
}

export interface CardBatchManifest {
  id: string;
  name: string;
  createdAt: string;
  rootDirectory: string;
  concurrency: number;
  agentCommandTemplate: string;
  gptReviewEnabled: boolean;
  gptReviewPrompt: string;
  hooks: CardBatchPromptHook[];
  jobs: CardBatchJob[];
}

export interface CardBatchCreateRequest {
  name?: string;
  urls: string;
  concurrency?: number;
  agentCommandTemplate?: string;
  gptReviewEnabled?: boolean;
  gptReviewPrompt?: string;
  hooks?: CardBatchPromptHook[];
}

export interface CardBatchCreateResponse {
  batch: CardBatchManifest;
  runnerCommand: string;
}

export interface CardBatchFollowupResponse {
  batchId: string;
  jobId: string;
  promptPath: string;
  runnerCommand: string;
}

export interface CardBatchImportResponse {
  created: number;
  merged: number;
  skipped: number;
  failed: number;
  reportPath: string;
}
