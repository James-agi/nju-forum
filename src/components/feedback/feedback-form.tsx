"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Send } from "lucide-react";
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
} from "@/lib/feedback/validation";

export function FeedbackForm() {
  const [category, setCategory] = useState<FeedbackCategory>("SUGGESTION");
  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
      setDone(true);
    } catch {
      setError("提交失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 border border-dashed border-border py-16 text-center">
        <CheckCircle2 className="h-10 w-10 text-[hsl(var(--status-active))]" />
        <div>
          <p className="font-medium text-foreground">反馈已收到，谢谢你！</p>
          <p className="mt-1 text-sm text-muted-foreground">
            你的建议会帮助知南变得更好。
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setDone(false);
              setContent("");
              setContact("");
              setCategory("SUGGESTION");
            }}
          >
            再提一条
          </Button>
          <Button asChild>
            <Link href="/forum">返回论坛</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
            {FEEDBACK_CATEGORIES.map((c) => (
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
  );
}
