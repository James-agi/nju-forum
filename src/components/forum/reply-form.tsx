"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare } from "lucide-react";

interface ReplyFormProps {
  postId: string;
  parentId?: string;
  onCancel?: () => void;
  placeholder?: string;
  canReply?: boolean;
}

export function ReplyForm({
  postId,
  parentId,
  onCancel,
  placeholder,
  canReply = true,
}: ReplyFormProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !canReply) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/posts/${postId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, parentId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "回复失败");
      } else {
        setContent("");
        onCancel?.();
        router.refresh();
      }
    } catch {
      setError("回复失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  };

  if (!canReply) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        登录后参与讨论。<Link href="/login" className="ml-1 text-primary hover:underline">立即登录</Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder || "写下你的回复..."}
        rows={parentId ? 3 : 4}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading || !content.trim()}>
          <MessageSquare className="mr-2 h-4 w-4" />
          {loading ? "发送中..." : "回复"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            取消
          </Button>
        )}
      </div>
    </form>
  );
}
