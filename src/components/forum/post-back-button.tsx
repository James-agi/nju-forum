"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function PostBackButton() {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/forum");
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      返回上一页
    </button>
  );
}
