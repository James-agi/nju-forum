import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { PostListItem } from "@/components/forum/post-list-item";
import { ForumDiscoverySection } from "@/components/forum/forum-discovery-section";
import { ArrowLeft, PenSquare } from "lucide-react";
import { getForumDiscoveryPosts } from "@/lib/forum/post-metrics";

export const dynamic = "force-dynamic";

const SECTION_DISCOVERY_POST_THRESHOLD = 12;

interface SectionPageProps {
  params: Promise<{ id: string }>;
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { id } = await params;
  const section = await db.section.findUnique({
    where: { id },
  });

  if (!section) notFound();

  const posts = await db.post.findMany({
    where: { sectionId: id },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      tags: { select: { id: true, name: true } },
      _count: { select: { replies: true, favorites: true } },
    },
  });

  const totalReplies = posts.reduce((sum, post) => sum + post._count.replies, 0);
  const { activePosts, hotPosts } = await getForumDiscoveryPosts({
    enabled: posts.length >= SECTION_DISCOVERY_POST_THRESHOLD,
    where: { sectionId: id },
    scope: { sectionId: id },
  });

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/forum">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回论坛
            </Link>
          </Button>
        </div>

        <div className="mb-10 animate-fade-in">
          <div className="flex items-start justify-between">
            <SectionLabel en="Section" zh={section.name} />
            <Button asChild>
              <Link href="/forum/new">
                <PenSquare className="mr-2 h-4 w-4" />
                发帖
              </Link>
            </Button>
          </div>
          {section.description && (
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
              {section.description}
            </p>
          )}
        </div>

        <div className="mb-8 flex gap-6 border-b border-border pb-4 text-sm">
          <div>
            <span className="text-stat">{posts.length}</span>
            <span className="ml-2 text-xs uppercase tracking-[0.15em] text-muted-foreground">帖子</span>
          </div>
          <div>
            <span className="text-stat">{totalReplies}</span>
            <span className="ml-2 text-xs uppercase tracking-[0.15em] text-muted-foreground">回复</span>
          </div>
        </div>

        <ForumDiscoverySection activePosts={activePosts} hotPosts={hotPosts} />

        <section className="animate-slide-up">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="section-label">分区帖子</h2>
            <span className="text-xs text-muted-foreground">置顶优先，最新在前</span>
          </div>
          <div className="mt-4 border-t border-border">
            {posts.map((post) => (
              <PostListItem key={post.id} post={post} showSection={false} />
            ))}
            {posts.length === 0 && (
              <div className="flex flex-col items-center gap-3 p-12 text-center">
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
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
