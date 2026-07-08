"use client";

import { useEffect, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  title: string;
  text?: string;
  className?: string;
}

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

export function ShareButton({ title, text, className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    if (!copied && !copyFailed) return;

    const timeoutId = window.setTimeout(() => {
      setCopied(false);
      setCopyFailed(false);
    }, 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copied, copyFailed]);

  async function handleShare() {
    const url = window.location.href;
    const shareData = { title, text, url };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await copyText(url);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  const Icon = copied ? Check : Share2;
  const label = copied ? "已复制" : copyFailed ? "复制失败" : "分享";

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleShare}
      className={cn("gap-2", className)}
      aria-live="polite"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );
}
