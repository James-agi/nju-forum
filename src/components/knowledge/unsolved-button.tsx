"use client";

import { useState } from "react";
import { ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function UnsolvedButton({ questionId }: { questionId: string }) {
  const [state, setState] = useState<"idle" | "open" | "sending" | "done" | "error">("idle");
  const [note, setNote] = useState("");

  const submit = async (includeNote: boolean) => {
    if (state === "sending" || state === "done") return;
    setState("sending");
    const body = includeNote ? { questionId, note } : { questionId };
    try {
      const res = await fetch("/api/knowledge/answer-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <p className="border-t pt-4 text-sm text-muted-foreground">
        已记录，谢谢。你说的会帮作者补到卡片里。
      </p>
    );
  }

  if (state === "idle") {
    return (
      <div className="flex flex-col gap-1 border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start text-muted-foreground"
          onClick={() => setState("open")}
        >
          <ThumbsDown className="mr-2 h-4 w-4" />
          这没解决我的问题
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <Textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        className="min-h-20"
        placeholder="说一句哪里没解决？比如你其实想问的是…… 作者会照着补卡片。"
        disabled={state === "sending"}
      />
      <p className="text-xs text-muted-foreground">可选填，留空也能交。</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => submit(true)}
          disabled={state === "sending"}
        >
          {state === "sending" ? "提交中" : "提交反馈"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => submit(false)}
          disabled={state === "sending"}
        >
          跳过，直接提交
        </Button>
      </div>
      {state === "error" && (
        <p className="text-sm text-destructive">反馈提交失败，请稍后重试。</p>
      )}
    </div>
  );
}
