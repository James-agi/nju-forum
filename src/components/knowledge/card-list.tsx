"use client";

import { useMemo, useState } from "react";
import { Archive, ChevronDown, ChevronUp, ExternalLink, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SOURCE_TYPE_LABELS,
  VERIFICATION_STATUS_LABELS,
  type KnowledgeCardDTO,
} from "@/lib/knowledge/types";

interface CardListProps {
  cards: KnowledgeCardDTO[];
  loading?: boolean;
  onEdit?: (card: KnowledgeCardDTO) => void;
  onArchive?: (card: KnowledgeCardDTO) => void;
}

function getPreview(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= 120) return compact;
  return `${compact.slice(0, 120)}...`;
}

export function CardList({ cards, loading, onEdit, onArchive }: CardListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
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
                <Card key={card.id} className="h-full">
                  <CardHeader className="gap-3 pb-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 space-y-2">
                      <CardTitle className="text-base leading-6">{card.summary}</CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{SOURCE_TYPE_LABELS[card.sourceType]}</Badge>
                        <Badge>{VERIFICATION_STATUS_LABELS[card.verificationStatus]}</Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {onEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(card)}
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
                          onClick={() => onArchive(card)}
                          aria-label={`归档 ${card.summary}`}
                          title="归档"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {expanded ? card.body : getPreview(card.body)}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="px-0"
                      onClick={() => toggleExpanded(card.id)}
                    >
                      {expanded ? (
                        <ChevronUp className="mr-2 h-4 w-4" />
                      ) : (
                        <ChevronDown className="mr-2 h-4 w-4" />
                      )}
                      {expanded ? "收起详情" : "展开详情"}
                    </Button>

                    {expanded && (
                      <div className="space-y-3 border-t pt-3">
                        <div className="flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
                          <span className="text-muted-foreground">
                            {card.sourceDescription}
                          </span>
                          {card.sourceUrl && (
                            <Button asChild variant="ghost" size="sm">
                              <a href={card.sourceUrl} target="_blank" rel="noreferrer">
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
