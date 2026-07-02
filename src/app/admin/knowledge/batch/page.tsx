"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  FileJson,
  KeyRound,
  MessageSquarePlus,
  Plus,
  Play,
  RefreshCw,
  Rocket,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MarkdownText, SourceExcerptBlock } from "@/components/knowledge/source-excerpt";
import {
  CARD_BATCH_PHASE_LABELS,
  CARD_BATCH_PHASES,
  type CardBatchCreateResponse,
  type CardBatchFollowupResponse,
  type CardBatchGptSettingsDTO,
  type CardBatchImportResponse,
  type CardBatchManifest,
  type CardBatchPhase,
  type CardBatchPromptHook,
} from "@/lib/knowledge/card-batch/types";
import {
  DEFAULT_AGENT_COMMAND_TEMPLATE,
  cloneDefaultHooks,
} from "@/lib/knowledge/card-batch/defaults";

const DEFAULT_URLS = "";

type PreviewCard = {
  summary?: string;
  body?: string;
  sourceExcerpt?: string;
  sourceUrl?: string;
  sourceDescription?: string;
  sourceType?: string;
  domainTag?: string;
  verificationStatus?: string;
};

type BatchDetail = {
  batch: Omit<CardBatchManifest, "jobs"> & {
    jobs: Array<CardBatchManifest["jobs"][number] & { cards?: PreviewCard[] | null }>;
  };
  runStatus?: { status?: string };
  allCards?: PreviewCard[] | null;
};

function newHook(): CardBatchPromptHook {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `hook-${Date.now()}`,
    title: "自定义规则",
    phase: "compare_source",
    enabled: true,
    order: 100,
    content: "",
  };
}

export default function AdminKnowledgeBatchPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [name, setName] = useState("");
  const [urls, setUrls] = useState(DEFAULT_URLS);
  const [concurrency, setConcurrency] = useState(2);
  const [agentCommandTemplate, setAgentCommandTemplate] = useState(
    DEFAULT_AGENT_COMMAND_TEMPLATE
  );
  const [gptReviewEnabled, setGptReviewEnabled] = useState(false);
  const [gptSettings, setGptSettings] = useState<CardBatchGptSettingsDTO | null>(null);
  const [gptApiUrl, setGptApiUrl] = useState("");
  const [gptApiKey, setGptApiKey] = useState("");
  const [gptModel, setGptModel] = useState("");
  const [gptReviewPrompt, setGptReviewPrompt] = useState("");
  const [hooks, setHooks] = useState<CardBatchPromptHook[]>(() => cloneDefaultHooks());
  const [batches, setBatches] = useState<CardBatchManifest[]>([]);
  const [latestResult, setLatestResult] = useState<CardBatchCreateResponse | null>(null);
  const [followupBatchId, setFollowupBatchId] = useState("");
  const [followupJobId, setFollowupJobId] = useState("");
  const [followupPrompt, setFollowupPrompt] = useState("");
  const [followupResult, setFollowupResult] =
    useState<CardBatchFollowupResponse | null>(null);
  const [importResult, setImportResult] = useState<CardBatchImportResponse | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [batchDetail, setBatchDetail] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingGpt, setTestingGpt] = useState(false);
  const [gptTestResult, setGptTestResult] = useState<string | null>(null);
  const [importingBatchId, setImportingBatchId] = useState<string | null>(null);
  const [runningBatchId, setRunningBatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

  const activeHookCount = useMemo(
    () => hooks.filter((hook) => hook.enabled && hook.content.trim()).length,
    [hooks]
  );
  const selectedFollowupBatch = useMemo(
    () => batches.find((batch) => batch.id === followupBatchId) || null,
    [batches, followupBatchId]
  );
  const previewCards = useMemo(() => {
    if (!batchDetail) return [];
    // Always prefer live job cards (kept up-to-date by followups) over the
    // static exports/all-cards.json snapshot.
    const jobCards = (batchDetail.batch?.jobs || []).flatMap((job) =>
      Array.isArray(job.cards) ? job.cards : []
    );
    if (jobCards.length > 0) return jobCards;
    if (Array.isArray(batchDetail.allCards) && batchDetail.allCards.length > 0) {
      return batchDetail.allCards;
    }
    return [];
  }, [batchDetail]);

  const fetchSettings = useCallback(async () => {
    const res = await fetch("/api/knowledge/card-batch-settings");
    const data = await res.json();
    if (!res.ok) return;

    const settings = data.settings as CardBatchGptSettingsDTO;
    setGptSettings(settings);
    setGptApiUrl(settings.apiUrl);
    setGptModel(settings.model);
    setGptReviewPrompt(settings.reviewPrompt);
  }, []);

  const fetchBatches = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/knowledge/card-batches");
      const data = await res.json();
      if (res.ok) setBatches(data.batches || []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const fetchBatchDetail = useCallback(async (batchId: string) => {
    if (!batchId) return;
    const res = await fetch(`/api/knowledge/card-batches/${encodeURIComponent(batchId)}`);
    const data = await res.json();
    if (res.ok) {
      setSelectedBatchId(batchId);
      setBatchDetail(data);
    }
  }, []);

  useEffect(() => {
    if (!selectedBatchId) return;
    const timer = window.setInterval(() => {
      fetchBatchDetail(selectedBatchId);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [fetchBatchDetail, selectedBatchId]);

  useEffect(() => {
    if (status === "unauthenticated" || (session?.user && session.user.role !== "ADMIN")) {
      router.push("/");
      return;
    }

    if (session?.user) {
      fetchBatches();
      fetchSettings();
    }
  }, [fetchBatches, fetchSettings, router, session, status]);

  const updateHook = (id: string, patch: Partial<CardBatchPromptHook>) => {
    setHooks((current) =>
      current.map((hook) => (hook.id === id ? { ...hook, ...patch } : hook))
    );
  };

  const removeHook = (id: string) => {
    setHooks((current) => current.filter((hook) => hook.id !== id));
  };

  const createBatch = async () => {
    setLoading(true);
    setError(null);
    setLatestResult(null);

    try {
      const res = await fetch("/api/knowledge/card-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          urls,
          concurrency,
          agentCommandTemplate,
          gptReviewEnabled,
          gptReviewPrompt,
          hooks,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "创建批量任务失败");
        return;
      }

      setLatestResult(data);
      setSelectedBatchId(data.batch.id);
      fetchBatchDetail(data.batch.id);
      fetchBatches();
    } catch {
      setError("创建批量任务失败");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    setError(null);

    try {
      const res = await fetch("/api/knowledge/card-batch-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: gptApiUrl,
          apiKey: gptApiKey,
          model: gptModel,
          reviewPrompt: gptReviewPrompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "保存 GPT 配置失败");
        return;
      }

      const settings = data.settings as CardBatchGptSettingsDTO;
      setGptSettings(settings);
      setGptApiKey("");
    } catch {
      setError("保存 GPT 配置失败");
    } finally {
      setSavingSettings(false);
    }
  };

  const testGptConnection = async () => {
    setTestingGpt(true);
    setGptTestResult(null);
    setError(null);

    try {
      const res = await fetch("/api/knowledge/card-batch-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: gptApiUrl,
          apiKey: gptApiKey,
          model: gptModel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGptTestResult(data.error || "GPT 连接测试失败");
        return;
      }

      setGptTestResult(`连接成功：${data.message || "OK"}`);
    } catch {
      setGptTestResult("GPT 连接测试失败");
    } finally {
      setTestingGpt(false);
    }
  };

  const importBatch = async (batchId: string) => {
    setImportingBatchId(batchId);
    setImportResult(null);
    setError(null);

    try {
      const res = await fetch("/api/knowledge/card-batches/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "批量入库失败");
        return;
      }

      setImportResult(data);
    } catch {
      setError("批量入库失败");
    } finally {
      setImportingBatchId(null);
    }
  };

  const startBatchRun = async (batchId: string) => {
    setRunningBatchId(batchId);
    setError(null);

    try {
      const res = await fetch("/api/knowledge/card-batches/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "启动运行失败");
        return;
      }

      setSelectedBatchId(batchId);
      fetchBatchDetail(batchId);
    } catch {
      setError("启动运行失败");
    } finally {
      setRunningBatchId(null);
    }
  };

  const createFollowup = async () => {
    setFollowupResult(null);
    setError(null);

    try {
      const res = await fetch("/api/knowledge/card-batches/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: followupBatchId,
          jobId: followupJobId,
          prompt: followupPrompt,
          runNow: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "追加 Prompt 失败");
        return;
      }

      setFollowupResult(data);
      setFollowupPrompt("");
      fetchBatchDetail(followupBatchId);
    } catch {
      setError("追加 Prompt 失败");
    }
  };

  if (status === "loading") {
    return <div className="p-6 text-sm text-muted-foreground">正在加载...</div>;
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/knowledge">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">批量制卡</h1>
          <p className="text-sm text-muted-foreground">
            固定五轮流程，按轮次发送 Prompt 和批量 URL。
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={fetchBatches}
          disabled={refreshing}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">批次</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="batch-name">名称</Label>
                <Input
                  id="batch-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如：新生交通专题"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-urls">URL</Label>
                <Textarea
                  id="batch-urls"
                  value={urls}
                  onChange={(event) => setUrls(event.target.value)}
                  placeholder={"每行一个 URL，或：网页主题 | https://example.com"}
                  className="min-h-44"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                <div className="space-y-2">
                  <Label htmlFor="batch-concurrency">并发</Label>
                  <Input
                    id="batch-concurrency"
                    type="number"
                    min={1}
                    max={8}
                    value={concurrency}
                    onChange={(event) => setConcurrency(Number(event.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agent-command">Agent 命令模板</Label>
                  <Input
                    id="agent-command"
                    value={agentCommandTemplate}
                    onChange={(event) => setAgentCommandTemplate(event.target.value)}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={gptReviewEnabled}
                  onChange={(event) => setGptReviewEnabled(event.target.checked)}
                />
                启用 GPT 用户视角审查并自动二轮迭代
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="button" onClick={createBatch} disabled={loading}>
                <Rocket className="mr-2 h-4 w-4" />
                {loading ? "生成中..." : "生成批次"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4" />
                GPT 配置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gpt-api-url">API URL</Label>
                <Input
                  id="gpt-api-url"
                  value={gptApiUrl}
                  onChange={(event) => setGptApiUrl(event.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
                <div className="space-y-2">
                  <Label htmlFor="gpt-api-key">API Key</Label>
                  <Input
                    id="gpt-api-key"
                    type="password"
                    value={gptApiKey}
                    onChange={(event) => setGptApiKey(event.target.value)}
                    placeholder={
                      gptSettings?.hasApiKey ? "已保存，留空则不修改" : "尚未保存"
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gpt-model">模型</Label>
                  <Input
                    id="gpt-model"
                    value={gptModel}
                    onChange={(event) => setGptModel(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gpt-review-prompt">审查 Prompt</Label>
                <Textarea
                  id="gpt-review-prompt"
                  value={gptReviewPrompt}
                  onChange={(event) => setGptReviewPrompt(event.target.value)}
                  className="min-h-32"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={saveSettings}
                  disabled={savingSettings}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {savingSettings ? "保存中..." : "保存配置"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={testGptConnection}
                  disabled={testingGpt}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  {testingGpt ? "测试中..." : "测试连接"}
                </Button>
              </div>
              {gptTestResult && (
                <p className="text-sm text-muted-foreground">{gptTestResult}</p>
              )}
            </CardContent>
          </Card>

          {latestResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">最新批次</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{latestResult.batch.name}</p>
                  <p className="break-all text-xs text-muted-foreground">
                    {latestResult.batch.rootDirectory}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="runner-command">Runner 命令</Label>
                  <Textarea
                    id="runner-command"
                    value={latestResult.runnerCommand}
                    readOnly
                    className="min-h-20 font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(latestResult.runnerCommand)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    复制
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {importResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">入库结果</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">
                  创建 {importResult.created} 张，跳过 {importResult.skipped} 张，失败{" "}
                  {importResult.failed} 张。
                </p>
                <p className="text-sm text-muted-foreground">
                  入库后已自动启动批次级工作流迭代任务。
                </p>
                <p className="break-all text-xs text-muted-foreground">
                  {importResult.reportPath}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">对话轮次 Prompt</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{activeHookCount} 个启用</Badge>
                <Button type="button" variant="outline" size="sm" onClick={() => setHooks((current) => [...current, newHook()])}>
                  <Plus className="mr-2 h-4 w-4" />
                  新增
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {hooks.map((hook) => (
                <div key={hook.id} className="rounded-md border p-3">
                  <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_170px_84px_auto]">
                    <label className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={hook.enabled}
                        onChange={(event) =>
                          updateHook(hook.id, { enabled: event.target.checked })
                        }
                        aria-label="启用 Prompt"
                      />
                    </label>
                    <Input
                      value={hook.title}
                      onChange={(event) => updateHook(hook.id, { title: event.target.value })}
                      placeholder="Prompt 名称"
                    />
                    <Select
                      value={hook.phase}
                      onValueChange={(value) =>
                        updateHook(hook.id, { phase: value as CardBatchPhase })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CARD_BATCH_PHASES.map((phase) => (
                          <SelectItem key={phase} value={phase}>
                            {CARD_BATCH_PHASE_LABELS[phase]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={hook.order}
                      onChange={(event) =>
                        updateHook(hook.id, { order: Number(event.target.value) || 0 })
                      }
                      aria-label="顺序"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeHook(hook.id)}
                      aria-label="删除 Prompt"
                      title="删除 Prompt"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={hook.content}
                    onChange={(event) => updateHook(hook.id, { content: event.target.value })}
                    className="mt-3 min-h-24"
                    placeholder="Prompt 内容"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquarePlus className="h-4 w-4" />
                追加对话
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>批次</Label>
                  <Select
                    value={followupBatchId}
                    onValueChange={(value) => {
                      setFollowupBatchId(value);
                      setFollowupJobId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择批次" />
                    </SelectTrigger>
                    <SelectContent>
                      {batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>任务</Label>
                  <Select value={followupJobId} onValueChange={setFollowupJobId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择任务" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedFollowupBatch?.jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.id} · {job.source.title || job.source.url}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="followup-prompt">追加 Prompt</Label>
                <Textarea
                  id="followup-prompt"
                  value={followupPrompt}
                  onChange={(event) => setFollowupPrompt(event.target.value)}
                  className="min-h-28"
                  placeholder="例如：这几张卡还是太像通知，请用新生视角重写并覆盖导出文件。"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={createFollowup}
                disabled={!followupBatchId || !followupJobId || !followupPrompt.trim()}
              >
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                发送并运行
              </Button>
              {followupResult && (
                <div className="space-y-2">
                  <Label htmlFor="followup-command">Runner 命令</Label>
                  <Textarea
                    id="followup-command"
                    value={followupResult.runnerCommand}
                    readOnly
                    className="min-h-20 font-mono text-xs"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">卡片预览</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!batchDetail ? (
                <p className="text-sm text-muted-foreground">选择批次后显示卡片。</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline">{batchDetail.batch.name}</Badge>
                    <Badge variant="secondary">
                      {batchDetail.runStatus?.status || "IDLE"}
                    </Badge>
                    <span className="text-muted-foreground">
                      {previewCards.length} 张卡片
                    </span>
                  </div>
                  {previewCards.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      暂无 cards.json 输出。
                    </p>
                  ) : (
                    previewCards.map((card, index) => (
                      <div key={`${card.summary}-${index}`} className="rounded-md border p-3">
                        <div
                          className="mb-2 flex cursor-pointer items-start justify-between gap-2"
                          onClick={() =>
                            setExpandedCards((prev) => {
                              const next = new Set(prev);
                              if (next.has(index)) {
                                next.delete(index);
                              } else {
                                next.add(index);
                              }
                              return next;
                            })
                          }
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge>{card.domainTag || "未分区"}</Badge>
                            <Badge variant="outline">
                              {card.verificationStatus || "NEEDS_REVIEW"}
                            </Badge>
                            <Badge variant="secondary">{card.sourceType || "OTHER"}</Badge>
                          </div>
                          {expandedCards.has(index) ? (
                            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                        </div>
                        <h3 className="font-medium">{card.summary || "未命名卡片"}</h3>
                        {expandedCards.has(index) ? (
                          <div className="mt-3 space-y-3">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">正文</p>
                              <MarkdownText text={card.body || ""} className="mt-1 text-sm" />
                            </div>
                            {card.sourceExcerpt && (
                              <SourceExcerptBlock sourceExcerpt={card.sourceExcerpt} />
                            )}
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <p>
                                <span className="font-medium">来源说明：</span>
                                {card.sourceDescription}
                              </p>
                              {card.sourceUrl && (
                                <p className="break-all">
                                  <span className="font-medium">来源链接：</span>
                                  {card.sourceUrl}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                            {card.body}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">最近批次</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {batches.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无批次。</p>
              ) : (
                batches.map((batch) => (
                  <div key={batch.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileJson className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{batch.name}</p>
                      <Badge variant="outline">{batch.jobs.length} 个 URL</Badge>
                      <Badge variant="secondary">{batch.concurrency} 并发</Badge>
                      {batch.gptReviewEnabled && <Badge>GPT 审查</Badge>}
                      <Button
                        type="button"
                        size="sm"
                        className="ml-auto"
                        onClick={() => startBatchRun(batch.id)}
                        disabled={runningBatchId === batch.id}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        运行
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fetchBatchDetail(batch.id)}
                      >
                        查看
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => importBatch(batch.id)}
                        disabled={importingBatchId === batch.id}
                      >
                        <Database className="mr-2 h-4 w-4" />
                        入库
                      </Button>
                    </div>
                    <p className="mt-2 break-all text-xs text-muted-foreground">
                      {batch.rootDirectory}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
