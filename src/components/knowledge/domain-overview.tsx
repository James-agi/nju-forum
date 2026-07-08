import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import {
  KNOWLEDGE_DOMAIN_TAG_DESCRIPTIONS,
  KNOWLEDGE_DOMAIN_TAGS,
  type KnowledgeDomainTagValue,
} from "@/lib/knowledge/types";

export async function KnowledgeDomainOverview() {
  const grouped = await db.knowledgeCard.groupBy({
    by: ["domainTag"],
    where: { archivedAt: null },
    _count: { _all: true },
  });

  const counts = new Map(
    grouped.map((item) => [item.domainTag, item._count._all])
  );

  const customCount = grouped
    .filter(
      (item) =>
        !KNOWLEDGE_DOMAIN_TAGS.includes(item.domainTag as KnowledgeDomainTagValue)
    )
    .reduce((sum, item) => sum + item._count._all, 0);

  return (
    <section className="mt-10 space-y-4 border-t border-border pt-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">知识卡片分区</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            卡片按宽泛主题归档；提问时不需要手动选择分区，系统会自动检索相关内容。
          </p>
        </div>
        {customCount > 0 && (
          <Badge variant="outline" className="w-fit">
            自定义专题 {customCount} 张
          </Badge>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {KNOWLEDGE_DOMAIN_TAGS.map((tag) => (
          <article key={tag} className="rounded-md border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                <h3 className="truncate text-sm font-semibold">{tag}</h3>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {counts.get(tag) ?? 0} 张
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {KNOWLEDGE_DOMAIN_TAG_DESCRIPTIONS[tag]}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
