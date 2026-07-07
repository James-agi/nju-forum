"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FeedbackArchiveButton({
  id,
  archived,
}: {
  id: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, archived: !archived }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={loading}
    >
      {archived ? (
        <>
          <ArchiveRestore className="mr-2 h-4 w-4" />
          恢复
        </>
      ) : (
        <>
          <Archive className="mr-2 h-4 w-4" />
          {loading ? "处理中" : "标记已处理"}
        </>
      )}
    </Button>
  );
}
