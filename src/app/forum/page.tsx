import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PostListItem } from "@/components/forum/post-list-item";
import { BookOpen, HelpCircle, MessageSquare, PenSquare } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ForumPage() {
  const sections = await db.section.findMany({
    orderBy: { order: "asc" },
    include: {
      _count: { select: { posts: true } },
    },
  });

  const recentPosts = await db.post.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      section: { select: { id: true, name: true, icon: true } },
      tags: { select: { id: true, name: true } },
      _count: { select: { replies: true, favorites: true } },
    },
  });

  const totalPosts = sections.reduce((sum, section) => sum + section._count.posts, 0);
  const totalReplies = recentPosts.reduce((sum, post) => sum + post._count.replies, 0);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-muted/20">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Badge variant="outline" className="w-fit">
              NJU Forum
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight">南大论坛</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              按分区浏览校园讨论，快速查看最新帖子、回复和收藏热度。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/forum/new">
                <PenSquare className="mr-2 h-4 w-4" />
                发帖
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/knowledge">
                <HelpCircle className="mr-2 h-4 w-4" />
                知识问答
              </Link>
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">分区</p>
                <p className="text-xl font-semibold">{sections.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <PenSquare className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">帖子</p>
                <p className="text-xl font-semibold">{totalPosts}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">近期回复</p>
                <p className="text-xl font-semibold">{totalReplies}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <section className="mb-8 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">论坛分区</h2>
            <span className="text-sm text-muted-foreground">选择一个分区继续浏览</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {sections.map((section) => (
              <Link key={section.id} href={`/forum/section/${section.id}`} className="block">
                <Card className="h-full border-border/80 transition-colors hover:border-foreground/20 hover:bg-background">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{section.icon || "📌"}</span>
                      <Badge variant="outline">{section._count.posts} 帖子</Badge>
                    </div>
                    <div>
                      <h3 className="font-semibold">{section.name}</h3>
                      {section.description && (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {section.description}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">最新帖子</h2>
            <span className="text-sm text-muted-foreground">按发布时间排序</span>
          </div>
          <div className="space-y-3">
            {recentPosts.map((post) => (
              <PostListItem key={post.id} post={post} />
            ))}
            {recentPosts.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                  <PenSquare className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">暂无帖子</p>
                    <p className="mt-1 text-sm text-muted-foreground">发布第一条校园讨论。</p>
                  </div>
                  <Button asChild>
                    <Link href="/forum/new">发帖</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
