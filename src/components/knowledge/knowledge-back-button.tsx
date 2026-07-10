"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function KnowledgeBackButton() {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/knowledge/cards");
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="w-fit px-0"
      onClick={handleBack}
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      返回上一页
    </Button>
  );
}
