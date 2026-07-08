"use client";

import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  FileUp,
  LinkIcon,
  Loader2,
  MessageSquareText,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  type FeedbackCategory,
  MATERIAL_TYPES,
  MATERIAL_TYPE_LABELS,
  type MaterialType,
} from "@/lib/feedback/validation";

const MAX_MATERIAL_FILES = 3;
const MAX_MATERIAL_BYTES = 20 * 1024 * 1024;
const GENERAL_FEEDBACK_CATEGORIES = FEEDBACK_CATEGORIES.filter(
  (category) => category !== "MATERIAL"
);

type FormMode = "feedback" | "material";
type DoneKind = FormMode | null;

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.ceil(bytes / 1024)}KB`;
  return `${bytes}B`;
}

export function FeedbackForm() {
  const searchParams = useSearchParams();
  const initialMode: FormMode =
    searchParams.get("mode") === "material" ? "material" : "feedback";
  const [mode, setMode] = useState<FormMode>(initialMode);
  const [category, setCategory] = useState<FeedbackCategory>("SUGGESTION");
  const [content, setContent] = useState("");
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialType, setMaterialType] =
    useState<MaterialType>("OFFICIAL_NOTICE");
  const [sourceUrl, setSourceUrl] = useState("");
  const [materialNote, setMaterialNote] = useState("");
  const [materialFiles, setMaterialFiles] = useState<File[]>([]);
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DoneKind>(null);

  useEffect(() => {
    if (searchParams.get("mode") === "material") {
      setMode("material");
    }
  }, [searchParams]);

  const resetFeedback = () => {
    setContent("");
    setCategory("SUGGESTION");
  };

  const resetMaterial = () => {
    setMaterialTitle("");
    setMaterialType("OFFICIAL_NOTICE");
    setSourceUrl("");
    setMaterialNote("");
    setMaterialFiles([]);
  };

  const handleMaterialFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setError(null);

    if (files.length > MAX_MATERIAL_FILES) {
      setError(`一次最多上传 ${MAX_MATERIAL_FILES} 个资料文件`);
      event.target.value = "";
      return;
    }

    const oversized = files.find((file) => file.size > MAX_MATERIAL_BYTES);
    if (oversized) {
      setError(`「${oversized.name}」超过 20MB，请压缩或改用 URL 提交`);
      event.target.value = "";
      return;
    }

    setMaterialFiles(files);
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError("请填写反馈内容");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, content, contact }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "提交失败");
        return;
      }
      setDone("feedback");
    } catch {
      setError("提交失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceUrl.trim() && materialFiles.length === 0 && !materialNote.trim()) {
      setError("请至少填写资料链接、上传文件或写一点补充说明");
      return;
    }

    const formData = new FormData();
    formData.append("title", materialTitle);
    formData.append("materialType", materialType);
    formData.append("sourceUrl", sourceUrl);
    formData.append("note", materialNote);
    formData.append("contact", contact);
    materialFiles.forEach((file) => formData.append("files", file));

    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "提交失败");
        return;
      }
      setDone("material");
    } catch {
      setError("提交失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    const isMaterialDone = done === "material";
    return (
      <div className="flex flex-col items-center gap-4 border border-dashed border-border py-16 text-center">
        <CheckCircle2 className="h-10 w-10 text-[hsl(var(--status-active))]" />
        <div>
          <p className="font-medium text-foreground">
            {isMaterialDone ? "资料已收到，谢谢你！" : "反馈已收到，谢谢你！"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isMaterialDone
              ? "我们会人工核验后用于资料库迭代，让后来的同学少走弯路。"
              : "你的建议会帮助知南变得更好。"}
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setDone(null);
              resetFeedback();
              resetMaterial();
              setContact("");
            }}
          >
            {isMaterialDone ? "再交一份资料" : "再提一条"}
          </Button>
          <Button asChild>
            <Link href="/forum">返回论坛</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setMode("feedback");
            setError(null);
          }}
          className={`rounded-md border p-4 text-left transition-colors ${
            mode === "feedback"
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-muted/50"
          }`}
        >
          <span className="flex items-center gap-2 font-medium">
            <MessageSquareText className="h-4 w-4" />
            意见反馈
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">
            反馈问题、体验和功能建议。
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("material");
            setError(null);
          }}
          className={`rounded-md border p-4 text-left transition-colors ${
            mode === "material"
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-muted/50"
          }`}
        >
          <span className="flex items-center gap-2 font-medium">
            <FileUp className="h-4 w-4" />
            提交资料
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">
            提供文件、网页 URL 或知识库补充线索。
          </span>
        </button>
      </div>

      {mode === "feedback" ? (
        <form onSubmit={handleFeedbackSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label>反馈类型</Label>
        <Select
          value={category}
          onValueChange={(v) => setCategory(v as FeedbackCategory)}
        >
          <SelectTrigger>
            <SelectValue placeholder="选择反馈类型" />
          </SelectTrigger>
          <SelectContent>
            {GENERAL_FEEDBACK_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {FEEDBACK_CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">反馈内容</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="遇到的问题、期望的功能、体验上的不顺畅……越具体越好。"
          rows={7}
          maxLength={2000}
        />
        <p className="text-right text-xs text-muted-foreground tabular-nums">
          {content.length}/2000
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact">联系方式（可选）</Label>
        <Input
          id="contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="邮箱 / 微信等，方便我们回访（不填也可以）"
          maxLength={200}
        />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" disabled={loading || !content.trim()} className="w-full sm:w-auto">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            提交中
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            提交反馈
          </>
        )}
      </Button>
    </form>
      ) : (
        <form onSubmit={handleMaterialSubmit} className="space-y-6">
          <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
            有官方通知、课程资料、校园生活经验、过期资料纠错都可以提交。越具体的来源越容易被整理进资料库。
          </div>

          <div className="space-y-2">
            <Label htmlFor="materialTitle">资料标题（可选）</Label>
            <Input
              id="materialTitle"
              value={materialTitle}
              onChange={(e) => setMaterialTitle(e.target.value)}
              placeholder="例如：2026 新生报到流程、某课程复习资料、宿舍信息补充"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label>资料类型</Label>
            <Select
              value={materialType}
              onValueChange={(v) => setMaterialType(v as MaterialType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择资料类型" />
              </SelectTrigger>
              <SelectContent>
                {MATERIAL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {MATERIAL_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceUrl">资料 URL（可选）</Label>
            <div className="relative">
              <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="sourceUrl"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="pl-9"
                maxLength={500}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="materialFiles">上传文件（可选）</Label>
            <Input
              id="materialFiles"
              type="file"
              multiple
              onChange={handleMaterialFiles}
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.jpg,.jpeg,.png,.webp,.zip"
            />
            <p className="text-xs text-muted-foreground">
              最多 {MAX_MATERIAL_FILES} 个文件，单个不超过 20MB。支持 PDF、Office、文本、图片和 zip。
            </p>
            {materialFiles.length > 0 && (
              <div className="space-y-1 rounded-md bg-muted/40 p-3 text-sm">
                {materialFiles.map((file) => (
                  <div key={`${file.name}-${file.size}`} className="flex justify-between gap-3">
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatBytes(file.size)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="materialNote">补充说明（可选）</Label>
            <Textarea
              id="materialNote"
              value={materialNote}
              onChange={(e) => setMaterialNote(e.target.value)}
              placeholder="这份资料适合回答什么问题？来源是否可靠？有没有需要特别注意的时间、校区或年级限制？"
              rows={6}
              maxLength={2000}
            />
            <p className="text-right text-xs text-muted-foreground tabular-nums">
              {materialNote.length}/2000
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="materialContact">联系方式（可选）</Label>
            <Input
              id="materialContact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="邮箱 / 微信等，方便我们核对来源（不填也可以）"
              maxLength={200}
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={
              loading ||
              (!sourceUrl.trim() && materialFiles.length === 0 && !materialNote.trim())
            }
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                提交中
              </>
            ) : (
              <>
                <FileUp className="mr-2 h-4 w-4" />
                提交资料
              </>
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
