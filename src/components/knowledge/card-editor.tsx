"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImagePlus, Save } from "lucide-react";
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
import {
  KNOWLEDGE_DOMAIN_TAG_DESCRIPTIONS,
  KNOWLEDGE_DOMAIN_TAGS,
  SOURCE_TYPE_LABELS,
  SOURCE_TYPES,
  VERIFICATION_STATUS_LABELS,
  VERIFICATION_STATUSES,
  type KnowledgeDomainTagValue,
  type KnowledgeCardDTO,
  type SourceTypeValue,
  type VerificationStatusValue,
} from "@/lib/knowledge/types";

interface CardEditorProps {
  card?: KnowledgeCardDTO | null;
  onSaved: (card: KnowledgeCardDTO) => void;
}

interface ImageCandidate {
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  source: "direct" | "page";
}

interface PreviewImagesResponse {
  mode: "direct" | "page";
  candidates: ImageCandidate[];
}

interface DownloadImagesResponse {
  markdown: string;
}

const emptyForm = {
  summary: "",
  body: "",
  sourceExcerpt: "",
  sourceUrl: "",
  sourceDescription: "",
  sourceType: "OFFICIAL" as SourceTypeValue,
  verificationStatus: "NEEDS_REVIEW" as VerificationStatusValue,
  domainTag: "新生入学",
};

const CUSTOM_DOMAIN_TAG = "__CUSTOM_DOMAIN_TAG__";
const SOURCE_EXCERPT_MAX_LENGTH = 12000;
const MAX_SELECTED_IMAGES = 5;

function isKnownDomainTag(value: string): value is KnowledgeDomainTagValue {
  return KNOWLEDGE_DOMAIN_TAGS.includes(value as KnowledgeDomainTagValue);
}

export function CardEditor({ card, onSaved }: CardEditorProps) {
  const [form, setForm] = useState(emptyForm);
  const formRef = useRef(form);
  formRef.current = form;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceImageUrl, setSourceImageUrl] = useState("");
  const [imageCandidates, setImageCandidates] = useState<ImageCandidate[]>([]);
  const [selectedImageUrls, setSelectedImageUrls] = useState<Set<string>>(new Set());
  const [imageImporting, setImageImporting] = useState(false);
  const [imageImportError, setImageImportError] = useState<string | null>(null);
  const [imageImportMessage, setImageImportMessage] = useState<string | null>(null);
  const domainTagSelectValue = isKnownDomainTag(form.domainTag)
    ? form.domainTag
    : CUSTOM_DOMAIN_TAG;
  const domainTagDescription = isKnownDomainTag(form.domainTag)
    ? KNOWLEDGE_DOMAIN_TAG_DESCRIPTIONS[form.domainTag]
    : "用于推荐分区放不下的特殊主题；名称尽量短，避免和已有分区同义重复。";

  useEffect(() => {
    setSourceImageUrl("");
    setImageCandidates([]);
    setSelectedImageUrls(new Set());
    setImageImportError(null);
    setImageImportMessage(null);

    if (card) {
      setForm({
        summary: card.summary,
        body: card.body,
        sourceExcerpt: card.sourceExcerpt ?? "",
        sourceUrl: card.sourceUrl ?? "",
        sourceDescription: card.sourceDescription,
        sourceType: card.sourceType,
        verificationStatus: card.verificationStatus,
        domainTag: card.domainTag,
      });
      return;
    }

    setForm(emptyForm);
  }, [card]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const appendImageMarkdown = (markdown: string) => {
    const trimmedMarkdown = markdown.trim();
    const currentExcerpt = formRef.current.sourceExcerpt.trimEnd();
    const nextSourceExcerpt = currentExcerpt
      ? `${currentExcerpt}\n\n${trimmedMarkdown}`
      : trimmedMarkdown;

    if (nextSourceExcerpt.length > SOURCE_EXCERPT_MAX_LENGTH) {
      setImageImportError("追加图片后原文摘录会超过 12000 字，请先删减一些摘录内容。");
      return false;
    }

    setForm((current) => ({ ...current, sourceExcerpt: nextSourceExcerpt }));
    return true;
  };

  const downloadImages = async (imageUrls: string[]) => {
    if (imageUrls.length === 0) {
      setImageImportError("请先选择要导入的图片。");
      return false;
    }

    const res = await fetch("/api/knowledge/source-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "download", imageUrls }),
    });
    const data = (await res.json().catch(() => ({}))) as
      | (Partial<DownloadImagesResponse> & { error?: string })
      | undefined;

    if (!res.ok || !data?.markdown) {
      setImageImportError(data?.error || "图片下载失败");
      return false;
    }

    if (!appendImageMarkdown(data.markdown)) return false;

    setImageImportMessage(`已追加 ${imageUrls.length} 张图片到原文摘录。保存卡片后生效。`);
    return true;
  };

  const previewSourceImages = async () => {
    const url = sourceImageUrl.trim();
    if (!url || imageImporting) return;

    setImageImporting(true);
    setImageImportError(null);
    setImageImportMessage(null);
    setImageCandidates([]);
    setSelectedImageUrls(new Set());

    try {
      const res = await fetch("/api/knowledge/source-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", url }),
      });
      const data = (await res.json().catch(() => ({}))) as
        | (Partial<PreviewImagesResponse> & { error?: string })
        | undefined;

      if (!res.ok || !data?.candidates) {
        setImageImportError(data?.error || "图片解析失败");
        return;
      }

      if (data.mode === "direct" && data.candidates[0]) {
        const imported = await downloadImages([data.candidates[0].url]);
        if (imported) setSourceImageUrl("");
        return;
      }

      setImageCandidates(data.candidates);
      if (data.candidates.length === 0) {
        setImageImportMessage("这个网页里没有找到可导入的图片。");
      }
    } catch {
      setImageImportError("图片解析失败，请稍后重试。");
    } finally {
      setImageImporting(false);
    }
  };

  const toggleImageCandidate = (url: string) => {
    setImageImportError(null);
    setSelectedImageUrls((current) => {
      const next = new Set(current);
      if (next.has(url)) {
        next.delete(url);
        return next;
      }

      if (next.size >= MAX_SELECTED_IMAGES) {
        setImageImportError("单次最多选择 5 张图片。");
        return current;
      }

      next.add(url);
      return next;
    });
  };

  const downloadSelectedImages = async () => {
    if (imageImporting) return;

    setImageImporting(true);
    setImageImportError(null);
    setImageImportMessage(null);

    try {
      const imported = await downloadImages(Array.from(selectedImageUrls));
      if (imported) {
        setImageCandidates([]);
        setSelectedImageUrls(new Set());
      }
    } catch {
      setImageImportError("图片下载失败，请稍后重试。");
    } finally {
      setImageImporting(false);
    }
  };

  const saveCard = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        card ? `/api/knowledge/cards/${card.id}` : "/api/knowledge/cards",
        {
          method: card ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "保存失败");
        return;
      }

      onSaved(data);
      if (!card) setForm(emptyForm);
    } catch {
      setError("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{card ? "编辑知识卡片" : "新建知识卡片"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="summary">摘要</Label>
            <Input
              id="summary"
              value={form.summary}
              onChange={(event) => updateField("summary", event.target.value)}
              placeholder="一句话概括这张卡片"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="body">正文</Label>
            <Textarea
              id="body"
              value={form.body}
              onChange={(event) => updateField("body", event.target.value)}
              className="min-h-36"
              placeholder="只写一个独立知识点，保留可用于回答的完整内容"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="sourceExcerpt">原文摘录（可空，仅展示用，不参与问答检索）</Label>
            <Textarea
              id="sourceExcerpt"
              value={form.sourceExcerpt}
              onChange={(event) => updateField("sourceExcerpt", event.target.value)}
              className="min-h-28"
              placeholder="逐字粘贴来源原文片段，供用户核对溯源；留空则不显示原文板块"
            />
          </div>

          <div className="space-y-3 rounded-md border p-3 md:col-span-2">
            <div className="space-y-1">
              <Label htmlFor="sourceImageUrl">从 URL 导入原文图片</Label>
              <p className="text-xs text-muted-foreground">
                支持图片直链或网页 URL。图片会下载到本地，并以图片引用追加到原文摘录。
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="sourceImageUrl"
                value={sourceImageUrl}
                onChange={(event) => setSourceImageUrl(event.target.value)}
                placeholder="粘贴图片 URL 或网页 URL"
              />
              <Button
                type="button"
                variant="outline"
                onClick={previewSourceImages}
                disabled={imageImporting || !sourceImageUrl.trim()}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                {imageImporting ? "处理中" : "解析图片"}
              </Button>
            </div>

            {imageImportError && (
              <p className="text-sm text-destructive">{imageImportError}</p>
            )}
            {imageImportMessage && (
              <p className="text-sm text-muted-foreground">{imageImportMessage}</p>
            )}

            {imageCandidates.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    找到 {imageCandidates.length} 张候选图片，选择真正有信息量的图片导入。
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={downloadSelectedImages}
                    disabled={imageImporting || selectedImageUrls.size === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    下载并追加
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {imageCandidates.map((candidate) => {
                    const selected = selectedImageUrls.has(candidate.url);
                    const dimensions =
                      candidate.width && candidate.height
                        ? `${candidate.width} x ${candidate.height}`
                        : "尺寸未知";

                    return (
                      <label
                        key={candidate.url}
                        className={`space-y-2 rounded-md border p-2 ${
                          selected ? "border-primary bg-primary/5" : "bg-background"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleImageCandidate(candidate.url)}
                            className="h-4 w-4"
                          />
                          <span className="min-w-0 truncate text-sm">
                            {candidate.alt || "未命名图片"}
                          </span>
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element -- 候选图来自任意外部 URL，不能交给 next/image 代理优化。 */}
                        <img
                          src={candidate.url}
                          alt={candidate.alt ?? "网页图片候选"}
                          className="h-32 w-full rounded-md border bg-muted/30 object-contain"
                          loading="lazy"
                        />
                        <p className="truncate text-xs text-muted-foreground">
                          {dimensions}
                        </p>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceDescription">来源说明</Label>
            <Input
              id="sourceDescription"
              value={form.sourceDescription}
              onChange={(event) => updateField("sourceDescription", event.target.value)}
              placeholder="如：南京大学官方说明页 / 问了某学长"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceUrl">来源链接</Label>
            <Input
              id="sourceUrl"
              value={form.sourceUrl}
              onChange={(event) => updateField("sourceUrl", event.target.value)}
              placeholder="可为空"
            />
          </div>

          <div className="space-y-2">
            <Label>来源类型</Label>
            <Select
              value={form.sourceType}
              onValueChange={(value) => updateField("sourceType", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {SOURCE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>核实状态</Label>
            <Select
              value={form.verificationStatus}
              onValueChange={(value) => updateField("verificationStatus", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VERIFICATION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {VERIFICATION_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>推荐分区 / 专题标签</Label>
            <Select
              value={domainTagSelectValue}
              onValueChange={(value) => {
                if (value === CUSTOM_DOMAIN_TAG) {
                  if (isKnownDomainTag(form.domainTag)) updateField("domainTag", "");
                  return;
                }

                updateField("domainTag", value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择推荐分区" />
              </SelectTrigger>
              <SelectContent>
                {KNOWLEDGE_DOMAIN_TAGS.map((tag) => (
                  <SelectItem key={tag} value={tag} className="py-2">
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{tag}</span>
                      <span className="text-xs text-muted-foreground">
                        {KNOWLEDGE_DOMAIN_TAG_DESCRIPTIONS[tag]}
                      </span>
                    </span>
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_DOMAIN_TAG}>自定义专题</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-muted-foreground">
              {domainTagDescription}
            </p>
            {domainTagSelectValue === CUSTOM_DOMAIN_TAG && (
              <Input
                id="domainTag"
                value={form.domainTag}
                onChange={(event) => updateField("domainTag", event.target.value)}
                placeholder="例如：暑期选课、AI工具、临时政策"
              />
            )}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end">
          <Button onClick={saveCard} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "保存中" : "保存卡片"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
