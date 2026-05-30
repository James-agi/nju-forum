import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PostListItem } from "@/components/forum/post-list-item";
import { ArrowLeft, MessageSquare, PenSquare } from "lucide-react";

export const dynamic = "force-dynamic";

interface SectionPageProps {
  params: { id: string };
}

export default async function SectionPage({ params }: SectionPageProps) {
  const section = await db.section.findUnique({
    where: { id: params.id },
  });

  if (!section) notFound();

  const posts = await db.post.findMany({
    where: { sectionId: params.id },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      tags: { select: { id: true, name: true } },
      _count: { select: { replies: true, favorites: true } },
    },
  });

  const totalReplies = posts.reduce((sum, post) => sum + post._count.replies, 0);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-muted/20">
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/forum">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回论坛
            </Link>
          </Button>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <Card>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border bg-background text-3xl">
                  {section.icon || "📌"}
                </div>
                <div>
                  <Badge variant="outline" className="mb-2">
                    论坛分区
                  </Badge>
                  <h1 className="text-2xl font-bold">{section.name}</h1>
                  {section.description && (
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {section.description}
                    </p>
                  )}
                </div>
              </div>
              <Button asChild className="w-full sm:w-auto">
                <Link href="/forum/new">
                  <PenSquare className="mr-2 h-4 w-4" />
                  发帖
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid h-full grid-cols-2 gap-3 p-5 lg:grid-cols-1">
              <div>
                <p className="text-sm text-muted-foreground">帖子</p>
                <p className="text-2xl font-semibold">{posts.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">回复</p>
                <p className="flex items-center gap-2 text-2xl font-semibold">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  {totalReplies}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">分区帖子</h2>
            <span className="text-sm text-muted-foreground">置顶优先，最新在前</span>
          </div>
          <div className="space-y-3">
            {posts.map((post) => (
              <PostListItem key={post.id} post={post} showSection={false} />
            ))}
            {posts.length === 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <PenSquare className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">该分区暂无帖子</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        在「{section.name}」发布第一条讨论。
                      </p>
                    </div>
                    <Button asChild>
                      <Link href="/forum/new">去发帖</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
