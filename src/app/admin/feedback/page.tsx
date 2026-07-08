import Link from "next/link";
import { requireAdmin } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, ExternalLink, Mail } from "lucide-react";
import { FeedbackArchiveButton } from "@/components/feedback/feedback-archive-button";
import {
  FEEDBACK_CATEGORY_LABELS,
  type FeedbackCategory,
} from "@/lib/feedback/validation";

export const dynamic = "force-dynamic";

function renderFeedbackContent(content: string) {
  return content.split("\n").map((line, index) => {
    const trimmed = line.trim();
    const urlMatch = trimmed.match(/^URL：(https?:\/\/\S+)$/);
    const downloadMatch = trimmed.match(
      /^下载：(\/api\/admin\/feedback\/materials\/[A-Za-z0-9._~/%-]+)$/
    );

    if (!trimmed) {
      return <div key={index} className="h-3" />;
    }

    if (urlMatch) {
      return (
        <div key={index} className="flex flex-wrap items-center gap-1.5">
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          <span>URL：</span>
          <a
            href={urlMatch[1]}
            target="_blank"
            rel="noreferrer"
            className="break-all text-primary underline-offset-4 hover:underline"
          >
            {urlMatch[1]}
          </a>
        </div>
      );
    }

    if (downloadMatch) {
      return (
        <div key={index} className="flex flex-wrap items-center gap-1.5">
          <Download className="h-3.5 w-3.5 text-muted-foreground" />
          <a
            href={downloadMatch[1]}
            className="text-primary underline-offset-4 hover:underline"
          >
            下载提交文件
          </a>
        </div>
      );
    }

    return <div key={index}>{line}</div>;
  });
}

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: { archived?: string };
}) {
  await requireAdmin();
  const showArchived = searchParams.archived === "1";

  const items = await db.websiteFeedback.findMany({
    where: { archivedAt: showArchived ? { not: null } : null },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true, email: true } } },
  });

  const pendingCount = await db.websiteFeedback.count({
    where: { archivedAt: null },
  });

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">用户反馈</h1>
          <p className="text-sm text-muted-foreground">
            用户对网站的问题反馈与建议。待处理 {pendingCount} 条。
          </p>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <Button asChild variant={showArchived ? "outline" : "default"} size="sm">
          <Link href="/admin/feedback">待处理</Link>
        </Button>
        <Button asChild variant={showArchived ? "default" : "outline"} size="sm">
          <Link href="/admin/feedback?archived=1">已处理</Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {showArchived ? "还没有已处理的反馈。" : "暂无待处理反馈。"}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-md border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    {FEEDBACK_CATEGORY_LABELS[item.category as FeedbackCategory] ??
                      item.category}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.user.name} · {new Date(item.createdAt).toLocaleString("zh-CN")}
                  </span>
                </div>
                <div className="shrink-0">
                  <FeedbackArchiveButton id={item.id} archived={!!item.archivedAt} />
                </div>
              </div>
              <div className="mt-3 text-sm leading-6">
                {renderFeedbackContent(item.content)}
              </div>
              {item.contact && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {item.contact}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
