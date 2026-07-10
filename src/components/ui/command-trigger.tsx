"use client";

import { Command } from "lucide-react";

export function CommandTrigger() {
  const triggerOpen = () => {
    window.dispatchEvent(new CustomEvent("command-palette:toggle"));
  };

  return (
    <button
      onClick={triggerOpen}
      className="fixed bottom-6 left-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background/80 shadow-lg backdrop-blur transition-all hover:scale-110 hover:border-foreground/30 hover:shadow-[0_0_15px_hsl(var(--foreground)/0.1)]"
      aria-label="打开命令面板"
    >
      <Command className="h-5 w-5 text-muted-foreground" />
    </button>
  );
}
