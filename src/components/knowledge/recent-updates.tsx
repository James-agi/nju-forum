import { Clock3 } from "lucide-react";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import {
  VERIFICATION_STATUS_LABELS,
  type VerificationStatusValue,
} from "@/lib/knowledge/types";

export const RECENT_UPDATE_PAGE_SIZE = 12;
const NEW_CARD_WINDOW_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_ENTRY_DAYS = 14;
const CONTENT_UPDATE_ENTRY_DAYS = 21;
const VERIFIED_ENTRY_DAYS = 7;

export const RECENT_UPDATE_KIND_FILTERS = [
  "all",
  "new",
  "content",
  "verified",
] as const;

export type RecentUpdateKindFilter = (typeof RECENT_UPDATE_KIND_FILTERS)[number];

export const RECENT_UPDATE_KIND_LABELS: Record<RecentUpdateKindFilter, string> = {
  all: "全部更新",
  new: "新增",
  content: "内容更新",
  verified: "已核实",
};

type UpdateEntry = {
  card: {
    id: string;
    summary: string;
    body: string;
    domainTag: string;
    verificationStatus: VerificationStatusValue;
    verifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    revisions: Array<{ summary: string; body: string; createdAt: Date }>;
  };
  kind: "新增" | "内容更新" | "已核实";
  kindFilter: Exclude<RecentUpdateKindFilter, "all">;
  displayAt: Date;
};

type HighlightedExcerpt = {
  prefix: string;
  changed: string;
  suffix: string;
};

function hasHighlightedExcerpt(excerpt: HighlightedExcerpt | null) {
  return Boolean(excerpt?.changed.trim());
}

function getPreview(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= 96) return compact;
  return `${compact.slice(0, 96)}...`;
}

function compactText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function getChangedRange(previous: string, current: string) {
  const before = compactText(previous);
  const after = compactText(current);

  if (!after || before === after) return null;

  const sentenceMatches = after.match(/[^。！？；.!?;]+[。！？；.!?;]?/g) ?? [];
  let cursor = 0;
  for (const segment of sentenceMatches) {
    const index = after.indexOf(segment, cursor);
    if (index < 0) continue;
    cursor = index + segment.length;

    const trimmed = segment.trim();
    if (trimmed.length >= 10 && !before.includes(trimmed)) {
      return {
        text: after,
        start: index,
        end: index + segment.length,
      };
    }
  }

  let start = 0;
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  ) {
    start += 1;
  }

  let unchangedTail = 0;
  while (
    unchangedTail < before.length - start &&
    unchangedTail < after.length - start &&
    before[before.length - 1 - unchangedTail] ===
      after[after.length - 1 - unchangedTail]
  ) {
    unchangedTail += 1;
  }

  return {
    text: after,
    start,
    end: Math.max(start + 1, after.length - unchangedTail),
  };
}

function getHighlightedExcerpt(
  current: string,
  previous?: string,
  maxLength = 132
): HighlightedExcerpt | null {
  if (!previous) return null;

  const changedRange = getChangedRange(previous, current);
  if (!changedRange) return null;

  const { text, start, end } = changedRange;
  const context = Math.max(20, Math.floor((maxLength - (end - start)) / 2));
  let excerptStart = Math.max(0, start - context);
  let excerptEnd = Math.min(text.length, end + context);

  if (excerptEnd - excerptStart < maxLength) {
    const remaining = maxLength - (excerptEnd - excerptStart);
    const extendLeft = Math.min(excerptStart, Math.floor(remaining / 2));
    excerptStart -= extendLeft;
    excerptEnd = Math.min(text.length, excerptEnd + remaining - extendLeft);
  }

  return {
    prefix: `${excerptStart > 0 ? "..." : ""}${text.slice(excerptStart, start)}`,
    changed: text.slice(start, end),
    suffix: `${text.slice(end, excerptEnd)}${excerptEnd < text.length ? "..." : ""}`,
  };
}

function HighlightedText({
  excerpt,
  fallback,
  className,
  as = "p",
}: {
  excerpt: HighlightedExcerpt | null;
  fallback: string;
  className: string;
  as?: "p" | "span";
}) {
  const Element = as;

  if (!excerpt) {
    return <Element className={className}>{fallback}</Element>;
  }

  return (
    <Element className={className}>
      {excerpt.prefix}
      <mark className="rounded-sm bg-yellow-300 px-1 py-0.5 font-medium text-yellow-950 ring-1 ring-yellow-500/60 dark:bg-yellow-400/35 dark:text-yellow-50 dark:ring-yellow-300/40">
        {excerpt.changed}
      </mark>
      {excerpt.suffix}
    </Element>
  );
}

function formatUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function withinDays(date: Date, now: Date, days: number) {
  return now.getTime() - date.getTime() <= days * DAY_MS;
}

function daysAgo(now: Date, days: number) {
  return new Date(now.getTime() - days * DAY_MS);
}

function toUpdateEntries(card: UpdateEntry["card"], now: Date): UpdateEntry[] {
  const entries: UpdateEntry[] = [];
  const latestRevisionAt = card.revisions[0]?.createdAt;

  if (
    latestRevisionAt &&
    latestRevisionAt.getTime() > card.createdAt.getTime() + NEW_CARD_WINDOW_MS &&
    withinDays(latestRevisionAt, now, CONTENT_UPDATE_ENTRY_DAYS)
  ) {
    entries.push({
      card,
      kind: "内容更新",
      kindFilter: "content",
      displayAt: latestRevisionAt,
    });
  }

  if (withinDays(card.createdAt, now, NEW_ENTRY_DAYS)) {
    entries.push({
      card,
      kind: "新增",
      kindFilter: "new",
      displayAt: card.createdAt,
    });
  }

  if (
    card.verificationStatus === "VERIFIED" &&
    card.verifiedAt &&
    withinDays(card.verifiedAt, now, VERIFIED_ENTRY_DAYS)
  ) {
    entries.push({
      card,
      kind: "已核实",
      kindFilter: "verified",
      displayAt: card.verifiedAt,
    });
  }

  return entries;
}

function toUpdateEntry(
  card: UpdateEntry["card"],
  now: Date,
  kind: RecentUpdateKindFilter
): UpdateEntry | null {
  const entries = toUpdateEntries(card, now)
    .filter((entry) => kind === "all" || entry.kindFilter === kind)
    .sort((a, b) => b.displayAt.getTime() - a.displayAt.getTime());

  return entries[0] ?? null;
}

function normalizePage(page: number) {
  if (!Number.isFinite(page)) return 1;
  return Math.max(1, Math.floor(page));
}

function getPageHref(params: {
  basePath: string;
  page: number;
  kind: RecentUpdateKindFilter;
  domainTag: string;
}) {
  const search = new URLSearchParams();

  if (params.page > 1) search.set("page", String(params.page));
  if (params.kind !== "all") search.set("type", params.kind);
  if (params.domainTag !== "all") search.set("domain", params.domainTag);

  const query = search.toString();
  return query ? `${params.basePath}?${query}` : params.basePath;
}

export async function RecentKnowledgeUpdates({
  showEmptyState = false,
  page = 1,
  kind = "all",
  domainTag = "all",
  basePath = "/knowledge/updates",
}: {
  showEmptyState?: boolean;
  page?: number;
  kind?: RecentUpdateKindFilter;
  domainTag?: string;
  basePath?: string;
} = {}) {
  const now = new Date();
  const currentPage = normalizePage(page);
  const recencyFilters: Prisma.KnowledgeCardWhereInput[] = [];

  if (kind === "all" || kind === "new") {
    recencyFilters.push({ createdAt: { gte: daysAgo(now, NEW_ENTRY_DAYS) } });
  }
  if (kind === "all" || kind === "content") {
    recencyFilters.push({
      revisions: {
        some: { createdAt: { gte: daysAgo(now, CONTENT_UPDATE_ENTRY_DAYS) } },
      },
    });
  }
  if (kind === "all" || kind === "verified") {
    recencyFilters.push({
      verificationStatus: "VERIFIED",
      verifiedAt: { gte: daysAgo(now, VERIFIED_ENTRY_DAYS) },
    });
  }

  const where: Prisma.KnowledgeCardWhereInput = {
    archivedAt: null,
    ...(domainTag !== "all" ? { domainTag } : {}),
    OR: recencyFilters,
  };

  const cards = await db.knowledgeCard.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      summary: true,
      body: true,
      domainTag: true,
      verificationStatus: true,
      verifiedAt: true,
      createdAt: true,
      updatedAt: true,
      revisions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { summary: true, body: true, createdAt: true },
      },
    },
  });

  const entries = cards
    .map((card) => toUpdateEntry(card, now, kind))
    .filter((entry): entry is UpdateEntry => entry !== null)
    .sort((a, b) => b.displayAt.getTime() - a.displayAt.getTime());

  const totalEntries = entries.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / RECENT_UPDATE_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * RECENT_UPDATE_PAGE_SIZE;
  const pageEntries = entries.slice(pageStart, pageStart + RECENT_UPDATE_PAGE_SIZE);

  if (pageEntries.length === 0) {
    if (!showEmptyState) return null;

    return (
      <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        最近没有符合展示规则的知识卡片更新。
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">最近更新</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            新增卡片展示 {NEW_ENTRY_DAYS} 天，正文或摘要更新展示{" "}
            {CONTENT_UPDATE_ENTRY_DAYS} 天，最近核实的卡片展示{" "}
            {VERIFIED_ENTRY_DAYS} 天；归档后立即退出。
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          共 {totalEntries} 条
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {pageEntries.map(({ card, kind, displayAt }) => {
          const previousRevision = card.revisions[0];
          const highlightedSummary =
            kind === "内容更新"
              ? getHighlightedExcerpt(card.summary, previousRevision?.summary, 96)
              : null;
          const highlightedBody =
            kind === "内容更新"
              ? getHighlightedExcerpt(card.body, previousRevision?.body)
              : null;
          const hasHighlight =
            hasHighlightedExcerpt(highlightedSummary) ||
            hasHighlightedExcerpt(highlightedBody);

          return (
            <Link
              key={card.id}
              href={`/knowledge/cards/${card.id}`}
              className="block h-full rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
            <Card className="h-full transition hover:border-primary/60 hover:shadow-md">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{kind}</Badge>
                  {hasHighlight && (
                    <Badge variant="outline" className="border-yellow-500/60 bg-yellow-100 text-yellow-900 dark:bg-yellow-400/15 dark:text-yellow-100">
                      高亮修改处
                    </Badge>
                  )}
                  <Badge variant="outline">{card.domainTag}</Badge>
                  <Badge variant="secondary">
                    {VERIFICATION_STATUS_LABELS[card.verificationStatus]}
                  </Badge>
                </div>
                <CardTitle className="text-base leading-6">
                  <HighlightedText
                    excerpt={highlightedSummary}
                    fallback={card.summary}
                    className="leading-6"
                    as="span"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <HighlightedText
                  excerpt={highlightedBody}
                  fallback={getPreview(card.body)}
                  className="text-sm leading-6 text-muted-foreground"
                />
                {kind === "内容更新" && !hasHighlight && (
                  <p className="text-xs leading-5 text-muted-foreground">
                    这条记录来自摘要或正文编辑，但当前预览没有定位到可高亮的文字差异。
                  </p>
                )}
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatUpdatedAt(displayAt)}
                  <span className="ml-auto">查看卡片</span>
                </p>
              </CardContent>
            </Card>
            </Link>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm">
          <span className="text-muted-foreground">
            第 {safePage} / {totalPages} 页
          </span>
          <div className="flex gap-2">
            {safePage <= 1 ? (
              <Button type="button" variant="outline" size="sm" disabled>
                上一页
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href={getPageHref({ basePath, page: safePage - 1, kind, domainTag })}>
                  上一页
                </Link>
              </Button>
            )}
            {safePage >= totalPages ? (
              <Button type="button" variant="outline" size="sm" disabled>
                下一页
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href={getPageHref({ basePath, page: safePage + 1, kind, domainTag })}>
                  下一页
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
