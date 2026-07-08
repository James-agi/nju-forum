"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Clock3, MessageSquareWarning, Search, Workflow, X } from "lucide-react";
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
  type Pagination,
  type VerificationStatusValue,
} from "@/lib/knowledge/types";

const ALL_FILTER_VALUE = "__ALL__";
const EMPTY_STATUS_COUNTS: Record<VerificationStatusValue, number> = {
  VERIFIED: 0,
  UNVERIFIED: 0,
  NEEDS_REVIEW: 0,
};

export function KnowledgeCardsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [cards, setCards] = useState<KnowledgeCardDTO[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [statusCounts, setStatusCounts] =
    useState<Record<VerificationStatusValue, number>>(EMPTY_STATUS_COUNTS);
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState(ALL_FILTER_VALUE);
  const [verificationFilter, setVerificationFilter] = useState(ALL_FILTER_VALUE);
  const [page, setPage] = useState(1);
  const [jumpPageInput, setJumpPageInput] = useState("1");
  const [editingCard, setEditingCard] = useState<KnowledgeCardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
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
      setPagination(data.pagination ?? null);
      setStatusCounts({ ...EMPTY_STATUS_COUNTS, ...(data.statusCounts ?? {}) });
    } catch {
      setError("获取知识卡片失败");
    } finally {
      setLoading(false);
    }
  }, [domainFilter, page, query, verificationFilter]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (session?.user) {
      fetchCards();
    }
  }, [fetchCards, router, session, status]);

  const archiveCard = async (card: KnowledgeCardDTO) => {
    if (!window.confirm(`确认归档「${card.summary}」吗？`)) return;

    try {
      const res = await fetch(`/api/knowledge/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        setError((data as { error?: string }).error || "归档失败");
        return;
      }
      if (editingCard?.id === card.id) setEditingCard(null);
      fetchCards();
    } catch {
      setError("归档失败，请稍后重试");
    }
  };

  const updateCardInList = (updatedCard: KnowledgeCardDTO) => {
    setCards((current) =>
      current.map((card) => (card.id === updatedCard.id ? updatedCard : card))
    );
    setEditingCard((current) =>
      current?.id === updatedCard.id ? updatedCard : current
    );
  };

  const totalPages = Math.max(1, pagination?.totalPages ?? 1);
  const currentPage = pagination?.page ?? page;
  const pageSize = pagination?.limit ?? 20;
  const totalCards = pagination?.total ?? 0;
  const backHref = isAdmin ? "/admin" : "/knowledge";
  const pageTitle = isAdmin ? "知识卡片管理" : "知识卡片";
  const pageDescription = isAdmin
    ? "录入可复用的校园知识，并保留来源与核实状态。"
    : "查看已收录的校园知识卡片，可按关键词、分区和核实状态筛选。";

  useEffect(() => {
    setJumpPageInput(String(currentPage));
  }, [currentPage]);

  const jumpToPage = () => {
    const parsedPage = Number.parseInt(jumpPageInput, 10);
    if (Number.isNaN(parsedPage)) {
      setJumpPageInput(String(currentPage));
      return;
    }

    const nextPage = Math.min(totalPages, Math.max(1, parsedPage));
    setJumpPageInput(String(nextPage));
    setPage(nextPage);
  };

  if (status === "loading") {
    return <div className="p-6 text-sm text-muted-foreground">正在加载...</div>;
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{pageTitle}</h1>
            <p className="text-sm text-muted-foreground">
              {pageDescription}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/knowledge/updates">
                <Clock3 className="mr-2 h-4 w-4" />
                最近更新
              </Link>
            </Button>
            {isAdmin && (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/knowledge/batch">
                    <Workflow className="mr-2 h-4 w-4" />
                    批量制卡
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/knowledge/feedback">
                    <MessageSquareWarning className="mr-2 h-4 w-4" />
                    没解决反馈
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_180px_auto_auto]">
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="搜索摘要、正文或来源"
          />
          <Select
            value={domainFilter}
            onValueChange={(value) => {
              setDomainFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="推荐分区" />
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
          <Select
            value={verificationFilter}
            onValueChange={(value) => {
              setVerificationFilter(value);
              setPage(1);
            }}
          >
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
                setPage(1);
              }}
            >
              <X className="mr-2 h-4 w-4" />
              清除
            </Button>
          )}
        </div>
      </div>

      <div className={isAdmin ? "grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]" : "grid gap-6"}>
        {isAdmin && (
          <CardEditor
            card={editingCard}
            onSaved={() => {
              setEditingCard(null);
              fetchCards();
            }}
          />
        )}
        <div className="space-y-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                共 {totalCards} 张，当前第 {currentPage} / {totalPages} 页，每页 {pageSize} 张
              </span>
              {VERIFICATION_STATUSES.map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant={verificationFilter === status ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setVerificationFilter(status);
                    setPage(1);
                  }}
                >
                  {VERIFICATION_STATUS_LABELS[status]} {statusCounts[status] ?? 0}
                </Button>
              ))}
              {verificationFilter !== ALL_FILTER_VALUE && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setVerificationFilter(ALL_FILTER_VALUE);
                    setPage(1);
                  }}
                >
                  全部状态
                </Button>
              )}
            </div>
          </div>
          <CardList
            cards={cards}
            loading={loading}
            onEdit={isAdmin ? setEditingCard : undefined}
            onArchive={isAdmin ? archiveCard : undefined}
            onUpdated={isAdmin ? updateCardInList : undefined}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm">
            <span className="text-muted-foreground">
              第 {currentPage} 页，共 {totalPages} 页
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || currentPage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                上一页
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || currentPage >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                下一页
              </Button>
              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  jumpToPage();
                }}
              >
                <span className="text-muted-foreground">跳至</span>
                <Input
                  type="number"
                  min={1}
                  max={totalPages}
                  inputMode="numeric"
                  value={jumpPageInput}
                  disabled={loading}
                  onChange={(event) => setJumpPageInput(event.target.value)}
                  className="h-9 w-20"
                  aria-label="跳转页码"
                />
                <span className="text-muted-foreground">页</span>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={loading}
                >
                  跳转
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
