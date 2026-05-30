"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CardEditor } from "@/components/knowledge/card-editor";
import { CardList } from "@/components/knowledge/card-list";
import {
  KNOWLEDGE_DOMAIN_TAGS,
  VERIFICATION_STATUS_LABELS,
  VERIFICATION_STATUSES,
  type KnowledgeCardDTO,
} from "@/lib/knowledge/types";

const ALL_FILTER_VALUE = "__ALL__";

export default function AdminKnowledgePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [cards, setCards] = useState<KnowledgeCardDTO[]>([]);
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState(ALL_FILTER_VALUE);
  const [verificationFilter, setVerificationFilter] = useState(ALL_FILTER_VALUE);
  const [editingCard, setEditingCard] = useState<KnowledgeCardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (domainFilter !== ALL_FILTER_VALUE) params.set("domainTag", domainFilter);
      if (verificationFilter !== ALL_FILTER_VALUE) {
        params.set("verificationStatus", verificationFilter);
      }

      const res = await fetch(`/api/knowledge/cards?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "获取知识卡片失败");
        return;
      }

      setCards(data.cards);
    } catch {
      setError("获取知识卡片失败");
    } finally {
      setLoading(false);
    }
  }, [domainFilter, query, verificationFilter]);

  useEffect(() => {
    if (status === "unauthenticated" || (session?.user && session.user.role !== "ADMIN")) {
      router.push("/");
      return;
    }

    if (session?.user) {
      fetchCards();
    }
  }, [fetchCards, router, session, status]);

  const archiveCard = async (card: KnowledgeCardDTO) => {
    if (!window.confirm(`确认归档「${card.summary}」吗？`)) return;

    await fetch(`/api/knowledge/cards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archive: true }),
    });
    if (editingCard?.id === card.id) setEditingCard(null);
    fetchCards();
  };

  if (status === "loading") {
    return <div className="p-6 text-sm text-muted-foreground">正在加载...</div>;
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">知识卡片管理</h1>
            <p className="text-sm text-muted-foreground">
              录入稳定的新生入学知识，并保留来源与核实状态。
            </p>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_180px_auto_auto]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索摘要、正文或来源"
          />
          <Select value={domainFilter} onValueChange={setDomainFilter}>
            <SelectTrigger>
              <SelectValue placeholder="知识分区" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>全部分区</SelectItem>
              {KNOWLEDGE_DOMAIN_TAGS.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={verificationFilter} onValueChange={setVerificationFilter}>
            <SelectTrigger>
              <SelectValue placeholder="核实状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>全部状态</SelectItem>
              {VERIFICATION_STATUSES.map((verificationStatus) => (
                <SelectItem key={verificationStatus} value={verificationStatus}>
                  {VERIFICATION_STATUS_LABELS[verificationStatus]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={fetchCards}
            aria-label="搜索知识卡片"
            title="搜索知识卡片"
          >
            <Search className="h-4 w-4" />
          </Button>
          {(query || domainFilter !== ALL_FILTER_VALUE || verificationFilter !== ALL_FILTER_VALUE) && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setQuery("");
                setDomainFilter(ALL_FILTER_VALUE);
                setVerificationFilter(ALL_FILTER_VALUE);
              }}
            >
              <X className="mr-2 h-4 w-4" />
              清除
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <CardEditor
          card={editingCard}
          onSaved={() => {
            setEditingCard(null);
            fetchCards();
          }}
        />
        <div className="space-y-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <CardList
            cards={cards}
            loading={loading}
            onEdit={setEditingCard}
            onArchive={archiveCard}
          />
        </div>
      </div>
    </div>
  );
}
