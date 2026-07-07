import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { AvatarUploader } from "@/components/user/avatar-uploader";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { Calendar, MessageSquare, BookOpen, Heart, Award } from "lucide-react";
import {
  levelProgress,
  CONTRIBUTION_TYPE_LABELS,
  type ContributionTypeValue,
} from "@/lib/contribution";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [pointsAgg, events] = await Promise.all([
    db.contributionEvent.aggregate({
      where: { userId: user.id },
      _sum: { points: true },
    }),
    db.contributionEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  const points = pointsAgg._sum.points ?? 0;
  const progress = levelProgress(points);

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <SectionLabel en="Profile · 个人中心" zh="个人中心" />
      <div className="mt-8 animate-fade-in">
        <Card>
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <AvatarUploader name={user.name} avatar={user.avatar} />
              <h1 className="mt-4 text-2xl font-bold">{user.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-3">
                <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                  {user.role === "ADMIN" ? "管理员" : "用户"}
                </Badge>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-border pt-8 text-center">
              <div>
                <BookOpen className="mx-auto h-5 w-5 text-muted-foreground mb-2" />
                <p className="text-3xl font-bold tabular-nums tracking-tight">{user._count.posts}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.15em] text-muted-foreground">帖子</p>
              </div>
              <div>
                <MessageSquare className="mx-auto h-5 w-5 text-muted-foreground mb-2" />
                <p className="text-3xl font-bold tabular-nums tracking-tight">{user._count.replies}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.15em] text-muted-foreground">回复</p>
              </div>
              <div>
                <Heart className="mx-auto h-5 w-5 text-muted-foreground mb-2" />
                <p className="text-3xl font-bold tabular-nums tracking-tight">{user._count.favorites}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.15em] text-muted-foreground">收藏</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              注册于 {new Date(user.createdAt).toLocaleDateString("zh-CN")}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-[hsl(var(--status-progress))]" />
                <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  贡献
                </h2>
              </div>
              <Badge variant="secondary">
                Lv.{progress.level} · {progress.title}
              </Badge>
            </div>

            <div className="mt-5 flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums tracking-tight">{points}</span>
              <span className="text-sm text-muted-foreground">贡献值</span>
            </div>

            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[hsl(var(--status-progress))] transition-all"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {progress.isMax
                  ? "已达最高等级"
                  : `距离 Lv.${progress.level + 1} 还需 ${progress.toNext} 分`}
              </p>
            </div>

            <div className="mt-6 border-t border-border pt-6">
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                贡献明细
              </p>
              {events.length === 0 ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  还没有贡献记录。当你的帖子被引用、或你提供资料帮助知识库迭代时，管理员会在这里为你记分。
                </p>
              ) : (
                <ul className="space-y-3">
                  {events.map((ev) => (
                    <li key={ev.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm leading-6">{ev.reason}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {CONTRIBUTION_TYPE_LABELS[ev.type as ContributionTypeValue] ?? ev.type}
                          {" · "}
                          {new Date(ev.createdAt).toLocaleDateString("zh-CN")}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-sm font-semibold tabular-nums ${
                          ev.points >= 0
                            ? "text-[hsl(var(--status-active))]"
                            : "text-destructive"
                        }`}
                      >
                        {ev.points >= 0 ? "+" : ""}
                        {ev.points}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
