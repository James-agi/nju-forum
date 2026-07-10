"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-medium text-muted-foreground">500</p>
      <h1 className="mt-3 text-3xl font-semibold text-foreground">页面暂时出错</h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
        请求没有完成。你可以重试一次，或稍后再访问。
      </p>
      <Button className="mt-8" onClick={reset}>
        重试
      </Button>
    </div>
  );
}
