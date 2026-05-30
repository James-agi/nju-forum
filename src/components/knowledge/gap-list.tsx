"use client";

import { useState } from "react";
import { Ban, CheckCircle2, Copy, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  GAP_STATUS_LABELS,
  type GapStatusValue,
  type KnowledgeCardDTO,
  type KnowledgeGapDTO,
} from "@/lib/knowledge/types";

interface GapListProps {
  gaps: KnowledgeGapDTO[];
  cards: KnowledgeCardDTO[];
  statusFilter: GapStatusValue | "ALL";
  loading?: boolean;
  onStatusFilterChange: (status: GapStatusValue | "ALL") => void;
  onRefresh: () => void;
}

export function GapList({
  gaps,
  cards,
  statusFilter,
  loading,
  onStatusFilterChange,
  onRefresh,
}: GapListProps) {
  const [linkedCardByGap, setLinkedCardByGap] = useState<Record<string, string>>({});
  const [duplicateByGap, setDuplicateByGap] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const updateGap = async (
    gap: KnowledgeGapDTO,
    status: "HANDLED" | "DUPLICATE" | "OUT_OF_SCOPE"
  ) => {
    setError(null);

    const body =
      status === "HANDLED"
        ? { status, linkedCardId: linkedCardByGap[gap.id] || gap.linkedCardId || "" }
        : status === "DUPLICATE"
          ? { status, duplicateOfId: duplicateByGap[gap.id] || "" }
          : { status };

    try {
      const res = await fetch(`/api/knowledge/gaps/${gap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "更新缺口失败");
        return;
      }

      onRefresh();
    } catch {
      setError("更新缺口失败");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as GapStatusValue | "ALL")}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部状态</SelectItem>
            <SelectItem value="OPEN">待处理</SelectItem>
            <SelectItem value="HANDLED">已处理</SelectItem>
            <SelectItem value="DUPLICATE">重复</SelectItem>
            <SelectItem value="OUT_OF_SCOPE">不属 P0</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>问题</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>关联卡片</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gaps.map((gap) => (
              <TableRow key={gap.id}>
                <TableCell className="min-w-72">
                  <p className="text-sm leading-6">{gap.originalQuestion}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(gap.createdAt).toLocaleString("zh-CN")}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge variant={gap.status === "OPEN" ? "secondary" : "outline"}>
                    {GAP_STATUS_LABELS[gap.status]}
                  </Badge>
                </TableCell>
                <TableCell className="min-w-64">
                  {gap.linkedCardSummary ? (
                    <p className="text-sm">{gap.linkedCardSummary}</p>
                  ) : (
                    <Select
                      value={linkedCardByGap[gap.id] || ""}
                      onValueChange={(value) =>
                        setLinkedCardByGap((current) => ({ ...current, [gap.id]: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择解决卡片" />
                      </SelectTrigger>
                      <SelectContent>
                        {cards.map((card) => (
                          <SelectItem key={card.id} value={card.id}>
                            {card.summary}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {gap.duplicateOfId && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      重复于 {gap.duplicateOfId}
                    </p>
                  )}
                </TableCell>
                <TableCell className="min-w-72 text-right">
                  {gap.status === "OPEN" ? (
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateGap(gap, "HANDLED")}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          已处理
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateGap(gap, "OUT_OF_SCOPE")}
                        >
                          <Ban className="mr-2 h-4 w-4" />
                          不属 P0
                        </Button>
                      </div>
                      <div className="flex w-full max-w-sm gap-2">
                        <Input
                          value={duplicateByGap[gap.id] || ""}
                          onChange={(event) =>
                            setDuplicateByGap((current) => ({
                              ...current,
                              [gap.id]: event.target.value,
                            }))
                          }
                          placeholder="重复缺口 ID"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateGap(gap, "DUPLICATE")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">已归档处理</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!loading && gaps.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            暂无缺口记录。
          </div>
        )}
        {loading && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            正在加载缺口库...
          </div>
        )}
      </div>
    </div>
  );
}
