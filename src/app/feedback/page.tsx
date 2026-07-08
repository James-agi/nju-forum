import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { SectionLabel } from "@/components/ui/section-label";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { CheckCircle2, Clock3 } from "lucide-react";
import {
  FEEDBACK_CATEGORY_LABELS,
  type FeedbackCategory,
} from "@/lib/feedback/validation";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const feedbackItems = await db.websiteFeedback.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      category: true,
      content: true,
      replyContent: true,
      repliedAt: true,
      createdAt: true,
      archivedAt: true,
    },
  });

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <SectionLabel en="Feedback · 意见反馈" zh="意见反馈" />
      <p className="mt-3 text-sm text-muted-foreground">
        知南还在打磨中，遇到任何问题、有想法，或者愿意提供资料帮助资料库迭代，都欢迎告诉我们。
      </p>
      <div className="mt-8 animate-fade-in">
        <FeedbackForm />
      </div>
      {feedbackItems.length > 0 && (
        <section className="mt-10 space-y-3">
          <div>
            <h2 className="text-lg font-semibold">我的反馈记录</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              管理员处理后，管理员回复会显示在这里。
            </p>
          </div>
          <div className="space-y-3">
            {feedbackItems.map((item) => (
              <article key={item.id} className="rounded-md border p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {FEEDBACK_CATEGORY_LABELS[item.category as FeedbackCategory] ??
                        item.category}
                    </span>
                    {item.archivedAt ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        已处理
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                        <Clock3 className="h-3 w-3" />
                        待处理
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString("zh-CN")}
                  </span>
                </div>
                <div className="mt-3 whitespace-pre-wrap leading-6 text-muted-foreground">
                  {item.content}
                </div>
                {item.replyContent ? (
                  <div className="mt-4 rounded-md border bg-muted/30 p-3">
                    <div className="mb-2 text-xs text-muted-foreground">
                      管理员回复
                      {item.repliedAt && (
                        <>
                          {" · "}
                          {new Date(item.repliedAt).toLocaleString("zh-CN")}
                        </>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap leading-6">{item.replyContent}</div>
                  </div>
                ) : (
                  item.archivedAt && (
                    <div className="mt-4 rounded-md border bg-muted/30 p-3">
                      <div className="mb-2 text-xs text-muted-foreground">
                        处理状态
                        {" · "}
                        {new Date(item.archivedAt).toLocaleString("zh-CN")}
                      </div>
                      <div className="leading-6">
                        已处理。管理员暂未填写回复，如需补充信息可以再次提交反馈。
                      </div>
                    </div>
                  )
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
