"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FeedbackReplyForm({
  id,
  initialReply = "",
}: {
  id: string;
  initialReply?: string | null;
}) {
  const router = useRouter();
  const [reply, setReply] = useState(initialReply ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitReply = async () => {
    const trimmed = reply.trim();
    if (!trimmed) {
      setError("请填写回复内容");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, replyContent: trimmed }),
      });
      const data = await res.json().catch(() => ({} as { error?: string }));

      if (!res.ok) {
        setError(data.error || "保存回复失败");
        return;
      }

      router.refresh();
    } catch {
      setError("保存回复失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 space-y-2 border-t pt-4">
      <label className="text-xs font-medium text-muted-foreground" htmlFor={`reply-${id}`}>
        管理员回复
      </label>
      <textarea
        id={`reply-${id}`}
        value={reply}
        onChange={(event) => setReply(event.target.value)}
        maxLength={2000}
        rows={3}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/40"
        placeholder="记录给用户的处理说明、修复结果或后续建议。"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{reply.length} / 2000</span>
        <Button
          type="button"
          size="sm"
          onClick={submitReply}
          disabled={loading}
        >
          <Send className="mr-2 h-4 w-4" />
          {loading ? "保存中" : "保存回复并标记已处理"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
