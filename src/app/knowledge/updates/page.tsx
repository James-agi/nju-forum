import Link from "next/link";
import { ArrowLeft, Library } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RECENT_UPDATE_KIND_FILTERS,
  RECENT_UPDATE_KIND_LABELS,
  RecentKnowledgeUpdates,
  type RecentUpdateKindFilter,
} from "@/components/knowledge/recent-updates";
import { KNOWLEDGE_DOMAIN_TAGS } from "@/lib/knowledge/types";
import { requireKnowledgePageUser } from "@/lib/knowledge/page-auth";

export const dynamic = "force-dynamic";

function parsePage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? 1);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function parseKind(value: string | string[] | undefined): RecentUpdateKindFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return RECENT_UPDATE_KIND_FILTERS.includes(raw as RecentUpdateKindFilter)
    ? (raw as RecentUpdateKindFilter)
    : "all";
}

function parseDomain(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && KNOWLEDGE_DOMAIN_TAGS.includes(raw as (typeof KNOWLEDGE_DOMAIN_TAGS)[number])
    ? raw
    : "all";
}

function getFilterHref(params: {
  type: RecentUpdateKindFilter;
  domain: string;
}) {
  const search = new URLSearchParams();
  if (params.type !== "all") search.set("type", params.type);
  if (params.domain !== "all") search.set("domain", params.domain);
  const query = search.toString();
  return query ? `/knowledge/updates?${query}` : "/knowledge/updates";
}

export default async function KnowledgeUpdatesPage({
  searchParams,
}: {
  searchParams: {
    page?: string | string[];
    type?: string | string[];
    domain?: string | string[];
  };
}) {
  await requireKnowledgePageUser();

  const page = parsePage(searchParams.page);
  const type = parseKind(searchParams.type);
  const domain = parseDomain(searchParams.domain);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Button asChild variant="ghost" size="sm" className="w-fit px-0">
            <Link href="/knowledge/cards">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回知识卡片
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">知识卡片最近更新</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              展示近期新增、正文或摘要被修改、以及已核实卡片的近期维护；点击任意条目可查看卡片全文和来源。
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/knowledge/cards">
            <Library className="mr-2 h-4 w-4" />
            全部卡片
          </Link>
        </Button>
      </div>

      <div className="mb-5 space-y-3 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">更新类型</span>
          {RECENT_UPDATE_KIND_FILTERS.map((item) => (
            <Button
              key={item}
              asChild
              variant={type === item ? "default" : "outline"}
              size="sm"
              className="h-8"
            >
              <Link href={getFilterHref({ type: item, domain })}>
                {RECENT_UPDATE_KIND_LABELS[item]}
              </Link>
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">分区</span>
          <Button
            asChild
            variant={domain === "all" ? "default" : "outline"}
            size="sm"
            className="h-8"
          >
            <Link href={getFilterHref({ type, domain: "all" })}>全部分区</Link>
          </Button>
          {KNOWLEDGE_DOMAIN_TAGS.map((tag) => (
            <Button
              key={tag}
              asChild
              variant={domain === tag ? "default" : "outline"}
              size="sm"
              className="h-8"
            >
              <Link href={getFilterHref({ type, domain: tag })}>{tag}</Link>
            </Button>
          ))}
        </div>
        {(type !== "all" || domain !== "all") && (
          <Badge variant="outline" className="w-fit">
            当前筛选：{RECENT_UPDATE_KIND_LABELS[type]} / {domain === "all" ? "全部分区" : domain}
          </Badge>
        )}
      </div>

      <RecentKnowledgeUpdates
        showEmptyState
        page={page}
        kind={type}
        domainTag={domain}
        basePath="/knowledge/updates"
      />
    </div>
  );
}
