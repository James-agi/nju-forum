"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Archive, ArrowLeft, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FeedbackItem {
  questionId: string;
  questionText: string;
  count: number;
  lastFeedbackAt: string | null;
  notes: { text: string; createdAt: string }[];
}

export default function AnswerFeedbackPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge/answer-feedback/list");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "获取反馈失败");
        return;
      }
      setItems(data.items);
    } catch {
      setError("获取反馈失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated" || (session?.user && session.user.role !== "ADMIN")) {
      router.push("/");
      return;
    }
    if (session?.user) {
      fetchFeedback();
    }
  }, [fetchFeedback, router, session, status]);

  const archiveFeedback = async (item: FeedbackItem) => {
    if (archivingId) return;
    if (!window.confirm(`确认归档「${item.questionText}」的没解决反馈吗？`)) return;

    setArchivingId(item.questionId);
    setError(null);

    try {
      const res = await fetch("/api/knowledge/answer-feedback/list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: item.questionId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "归档反馈失败");
        return;
      }

      setItems((current) => current.filter((currentItem) => currentItem.questionId !== item.questionId));
    } catch {
      setError("归档反馈失败");
    } finally {
      setArchivingId(null);
    }
  };

  if (status === "loading") {
    return <div className="p-6 text-sm text-muted-foreground">正在加载...</div>;
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/knowledge">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">答了但没解决的问题</h1>
          <p className="text-sm text-muted-foreground">
            这些问题 Agent 给了答案，但用户点了「这没解决我的问题」。比空白缺口更精准地告诉你哪张卡该补角度。
          </p>
        </div>
      </div>
      <FeedbackBody
        loading={loading}
        error={error}
        items={items}
        archivingId={archivingId}
        onArchive={archiveFeedback}
      />
    </div>
  );
}

function FeedbackBody({
  loading,
  error,
  items,
  archivingId,
  onArchive,
}: {
  loading: boolean;
  error: string | null;
  items: FeedbackItem[];
  archivingId: string | null;
  onArchive: (item: FeedbackItem) => void;
}) {
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (loading) {
    return <p className="text-sm text-muted-foreground">正在加载...</p>;
  }
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        还没有「没解决」反馈。用户对答案不满意时点的按钮会汇到这里。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.questionId} className="rounded-md border p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="flex-1 text-sm font-medium leading-6">{item.questionText}</p>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs text-destructive">
                <MessageSquareWarning className="h-3 w-3" />
                点没解决 {item.count} 次
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onArchive(item)}
                disabled={archivingId === item.questionId}
              >
                <Archive className="mr-2 h-4 w-4" />
                {archivingId === item.questionId ? "归档中" : "归档"}
              </Button>
            </div>
          </div>
          {item.lastFeedbackAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              最近反馈：{new Date(item.lastFeedbackAt).toLocaleString("zh-CN")}
            </p>
          )}
          {item.notes.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">用户留下的话</p>
              <ul className="space-y-2">
                {item.notes.map((note) => (
                  <li
                    key={`${item.questionId}-${note.createdAt}`}
                    className="border-l-2 border-muted-foreground/30 pl-3"
                  >
                    <p className="whitespace-pre-wrap text-sm leading-6">{note.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(note.createdAt).toLocaleString("zh-CN")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
