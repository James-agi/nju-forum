"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoginGate() {
  return (
    <div className="relative mt-2">
      <div className="absolute inset-x-0 -top-24 h-24 bg-gradient-to-b from-transparent to-background" />
      <div className="flex flex-col items-center gap-4 border border-dashed border-border/60 bg-background/80 px-6 py-12 text-center backdrop-blur">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">登录后查看全部内容</p>
          <p className="mt-1 text-xs text-muted-foreground">南大邮箱验证，保障社区质量</p>
        </div>
        <Button asChild size="sm" className="rounded-none">
          <Link href="/login">登录解锁 →</Link>
        </Button>
      </div>
    </div>
  );
}
