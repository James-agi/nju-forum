"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PostExitKey() {
  const router = useRouter();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      // 有模态层（命令面板等）打开时不劫持 ESC
      if (document.querySelector("[data-command-palette]")) return;
      router.back();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [router]);

  return (
    <div className="fixed bottom-[4.5rem] right-6 z-40 flex items-center gap-1.5 text-xs text-muted-foreground/60">
      <kbd className="inline-flex h-5 items-center rounded border border-border/50 bg-muted/50 px-1.5 font-mono text-[10px]">
        ESC
      </kbd>
      <span>返回</span>
    </div>
  );
}
