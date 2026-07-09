"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  title: string;
  text?: string;
  className?: string;
}

type CopyTarget = "content" | "link" | null;

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function compactShareText(text?: string) {
  const compact = text?.replace(/\s+/g, " ").trim() ?? "";
  if (compact.length <= 60) return compact;
  return `${compact.slice(0, 57)}...`;
}

export function ShareButton({ title, text, className }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  useEffect(() => {
    if (!copiedTarget && !copyFailed) return;

    const timeoutId = window.setTimeout(() => {
      setCopiedTarget(null);
      setCopyFailed(false);
    }, 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copiedTarget, copyFailed]);

  const shareContent = useMemo(() => {
    const preview = compactShareText(text);
    return [title, preview, url ? `链接：${url}` : ""].filter(Boolean).join("\n\n");
  }, [text, title, url]);

  async function copyShareContent(target: Exclude<CopyTarget, null>) {
    const value = target === "link" ? url || window.location.href : shareContent;

    try {
      await copyText(value);
      setCopiedTarget(target);
      setCopyFailed(false);
    } catch {
      setCopiedTarget(null);
      setCopyFailed(true);
    }
  }

  const contentCopyLabel = copyFailed
    ? "复制失败"
    : copiedTarget === "content"
      ? "已复制"
      : "复制分享内容";
  const linkCopyLabel = copiedTarget === "link" ? "链接已复制" : "只复制链接";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className={cn("gap-2", className)}>
          <Send className="h-4 w-4" />
          转发
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>复制后发给同学</DialogTitle>
          <DialogDescription>
            这段内容已经包含标题、摘要和链接，可直接粘贴到微信、QQ 或群聊。
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-3">
          <Textarea
            readOnly
            value={shareContent || "正在生成分享内容..."}
            className="min-h-[150px] resize-none break-all leading-6"
            aria-label="分享内容"
            onFocus={(event) => event.currentTarget.select()}
          />

          <Button
            type="button"
            className="w-full gap-2"
            onClick={() => copyShareContent("content")}
            aria-live="polite"
          >
            {copiedTarget === "content" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {contentCopyLabel}
          </Button>

          <div className="grid min-w-0 gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => copyShareContent("link")}
            >
              {copiedTarget === "link" ? (
                <Check className="h-4 w-4" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {linkCopyLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
