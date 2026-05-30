"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GapList } from "@/components/knowledge/gap-list";
import type {
  GapStatusValue,
  KnowledgeCardDTO,
  KnowledgeGapDTO,
} from "@/lib/knowledge/types";

export default function AdminGapsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [gaps, setGaps] = useState<KnowledgeGapDTO[]>([]);
  const [cards, setCards] = useState<KnowledgeCardDTO[]>([]);
  const [statusFilter, setStatusFilter] = useState<GapStatusValue | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGaps = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(`/api/knowledge/gaps?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "获取缺口库失败");
        return;
      }

      setGaps(data.gaps);
    } catch {
      setError("获取缺口库失败");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge/cards");
      const data = await res.json();
      if (res.ok) setCards(data.cards);
    } catch {
      // keep gap review usable even if card options fail
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated" || (session?.user && session.user.role !== "ADMIN")) {
      router.push("/");
      return;
    }

    if (session?.user) {
      fetchGaps();
      fetchCards();
    }
  }, [fetchCards, fetchGaps, router, session, status]);

  if (status === "loading") {
    return <div className="p-6 text-sm text-muted-foreground">正在加载...</div>;
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">缺口库</h1>
          <p className="text-sm text-muted-foreground">
            查看答不上来的问题，并决定补哪张知识卡片。
          </p>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <GapList
        gaps={gaps}
        cards={cards}
        statusFilter={statusFilter}
        loading={loading}
        onStatusFilterChange={setStatusFilter}
        onRefresh={fetchGaps}
      />
    </div>
  );
}
