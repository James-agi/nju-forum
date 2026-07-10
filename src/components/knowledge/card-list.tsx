"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Archive, BookOpen, Check, ChevronDown, ChevronUp, ExternalLink, Loader2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LinkifiedText, MarkdownText, SourceExcerptBlock } from "@/components/knowledge/source-excerpt";
import {
  SOURCE_TYPE_LABELS,
  VERIFICATION_STATUS_LABELS,
  VERIFICATION_STATUSES,
  type KnowledgeCardDTO,
  type VerificationStatusValue,
} from "@/lib/knowledge/types";

interface CardListProps {
  cards: KnowledgeCardDTO[];
  loading?: boolean;
  onEdit?: (card: KnowledgeCardDTO) => void;
  onArchive?: (card: KnowledgeCardDTO) => void;
  onUpdated?: (card: KnowledgeCardDTO) => void;
}

function getPreview(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= 120) return compact;
  return `${compact.slice(0, 120)}...`;
}

function VerificationStatusMenu({
  card,
  disabled,
  updating,
  onChange,
}: {
  card: KnowledgeCardDTO;
  disabled: boolean;
  updating: boolean;
  onChange: (card: KnowledgeCardDTO, status: VerificationStatusValue) => void;
}) {
  const label = VERIFICATION_STATUS_LABELS[card.verificationStatus];

  if (disabled) {
    return (
      <Badge>
        {updating && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
        {updating ? "更新中" : label}
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          className="h-6 rounded-full px-2.5 py-0 text-xs font-semibold"
          onClick={(event) => event.stopPropagation()}
        >
          {label}
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {VERIFICATION_STATUSES.map((status) => (
          <DropdownMenuItem
            key={status}
            onSelect={() => onChange(card, status)}
          >
            <Check
              className={`mr-2 h-4 w-4 ${
                card.verificationStatus === status ? "opacity-100" : "opacity-0"
              }`}
            />
            {VERIFICATION_STATUS_LABELS[status]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CardList({ cards, loading, onEdit, onArchive, onUpdated }: CardListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [updatingVerificationId, setUpdatingVerificationId] = useState<string | null>(null);
  const groupedCards = useMemo(() => {
    const groups = new Map<string, KnowledgeCardDTO[]>();

    for (const card of cards) {
      const key = card.domainTag || "未分区";
      groups.set(key, [...(groups.get(key) ?? []), card]);
    }

    return Array.from(groups.entries());
  }, [cards]);

  const toggleExpanded = (cardId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const expandCard = (cardId: string) => {
    setExpandedIds((current) => {
      if (current.has(cardId)) return current;

      const next = new Set(current);
      next.add(cardId);
      return next;
    });
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>, cardId: string) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    expandCard(cardId);
  };

  const updateVerificationStatus = async (
    card: KnowledgeCardDTO,
    verificationStatus: VerificationStatusValue
  ) => {
    if (!onUpdated || card.verificationStatus === verificationStatus || updatingVerificationId) {
      return;
    }

    setUpdatingVerificationId(card.id);
    try {
      const res = await fetch(`/api/knowledge/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationStatus }),
      });
      const data = await res.json();

      if (!res.ok) {
        window.alert(data.error || "更新核实状态失败");
        return;
      }

      onUpdated(data);
    } catch {
      window.alert("更新核实状态失败");
    } finally {
      setUpdatingVerificationId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          正在加载知识卡片...
        </CardContent>
      </Card>
    );
  }

  if (cards.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          暂无知识卡片。
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {groupedCards.map(([domainTag, groupCards]) => (
        <section key={domainTag} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              知识分区：{domainTag}
            </h2>
            <Badge variant="outline">{groupCards.length} 张</Badge>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {groupCards.map((card) => {
              const expanded = expandedIds.has(card.id);

              return (
                <Card
                  key={card.id}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "收起" : "核实"}知识卡片：${card.summary}`}
                  className="h-full cursor-pointer transition hover:border-primary/60 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onClick={() => expandCard(card.id)}
                  onKeyDown={(event) => handleCardKeyDown(event, card.id)}
                >
                  <CardHeader className="gap-3 pb-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 space-y-2">
                      <CardTitle className="text-base leading-6">{card.summary}</CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{SOURCE_TYPE_LABELS[card.sourceType]}</Badge>
                        <VerificationStatusMenu
                          card={card}
                          disabled={!onUpdated || updatingVerificationId !== null}
                          updating={updatingVerificationId === card.id}
                          onChange={updateVerificationStatus}
                        />
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/knowledge/cards/${card.id}`}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`查看 ${card.summary}`}
                          title="查看卡片"
                        >
                          <BookOpen className="h-4 w-4" />
                        </Link>
                      </Button>
                      {onEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEdit(card);
                          }}
                          aria-label={`编辑 ${card.summary}`}
                          title="编辑"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {onArchive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onArchive(card);
                          }}
                          aria-label={`归档 ${card.summary}`}
                          title="归档"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <MarkdownText
                      text={expanded ? card.body : getPreview(card.body)}
                      className="text-sm leading-6 text-muted-foreground"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="px-0"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleExpanded(card.id);
                      }}
                    >
                      {expanded ? (
                        <ChevronUp className="mr-2 h-4 w-4" />
                      ) : (
                        <ChevronDown className="mr-2 h-4 w-4" />
                      )}
                      {expanded ? "收起核实材料" : "核实来源"}
                    </Button>

                    {expanded && (
                      <div className="space-y-3 border-t pt-3">
                        {card.sourceExcerpt && (
                          <SourceExcerptBlock sourceExcerpt={card.sourceExcerpt} />
                        )}
                        <div className="flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
                          <span className="break-words text-muted-foreground">
                            <LinkifiedText text={card.sourceDescription} />
                          </span>
                          {card.sourceUrl && (
                            <Button asChild variant="ghost" size="sm">
                              <a
                                href={card.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                查看来源
                              </a>
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          更新于 {new Date(card.updatedAt).toLocaleString("zh-CN")}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
