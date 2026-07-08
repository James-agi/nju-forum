import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock3, ExternalLink, Library } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KnowledgeBackButton } from "@/components/knowledge/knowledge-back-button";
import {
  LinkifiedText,
  MarkdownText,
  SourceExcerptBlock,
} from "@/components/knowledge/source-excerpt";
import { db } from "@/lib/db";
import { requireKnowledgePageUser } from "@/lib/knowledge/page-auth";
import {
  SOURCE_TYPE_LABELS,
  VERIFICATION_STATUS_LABELS,
  type SourceTypeValue,
  type VerificationStatusValue,
} from "@/lib/knowledge/types";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function KnowledgeCardDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireKnowledgePageUser();

  const card = await db.knowledgeCard.findFirst({
    where: { id: params.id, archivedAt: null },
    select: {
      id: true,
      summary: true,
      body: true,
      sourceExcerpt: true,
      sourceUrl: true,
      sourceDescription: true,
      sourceType: true,
      verificationStatus: true,
      verifiedAt: true,
      domainTag: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!card) notFound();

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <KnowledgeBackButton />
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{card.domainTag}</Badge>
              <Badge variant="secondary">
                {SOURCE_TYPE_LABELS[card.sourceType as SourceTypeValue]}
              </Badge>
              <Badge>
                {VERIFICATION_STATUS_LABELS[
                  card.verificationStatus as VerificationStatusValue
                ]}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold leading-9">{card.summary}</h1>
            <p className="text-sm text-muted-foreground">
              创建于 {formatDate(card.createdAt)}，更新于 {formatDate(card.updatedAt)}
              {card.verifiedAt ? `，核实于 ${formatDate(card.verifiedAt)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/knowledge/updates">
              <Clock3 className="mr-2 h-4 w-4" />
              最近更新
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/knowledge/cards">
              <Library className="mr-2 h-4 w-4" />
              全部卡片
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">正文</CardTitle>
          </CardHeader>
          <CardContent>
            <MarkdownText text={card.body} className="text-sm leading-7" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">来源与核实材料</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {card.sourceExcerpt ? (
              <SourceExcerptBlock sourceExcerpt={card.sourceExcerpt} />
            ) : (
              <p className="text-sm text-muted-foreground">暂无逐字来源摘录。</p>
            )}
            <div className="flex flex-col gap-3 border-t pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="break-words text-muted-foreground">
                <LinkifiedText text={card.sourceDescription} />
              </span>
              {card.sourceUrl && (
                <Button asChild variant="outline" size="sm">
                  <a href={card.sourceUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    查看来源
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
