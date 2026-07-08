import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ViewSwitcher } from "@/components/forum/view-switcher";
import { PostListRow } from "@/components/forum/post-list-row";
import { PostCard } from "@/components/forum/post-card";
import { TopicCard } from "@/components/forum/topic-card";
import { TagCloud } from "@/components/forum/tag-cloud";
import { ForumDiscoverySection } from "@/components/forum/forum-discovery-section";
import { LoginGate } from "@/components/auth/login-gate";
import { Button } from "@/components/ui/button";
import { PenSquare, Search, X } from "lucide-react";
import { getForumDiscoveryPosts } from "@/lib/forum/post-metrics";

export const dynamic = "force-dynamic";

type SearchParams = { view?: string; tag?: string; topic?: string };

const GLOBAL_DISCOVERY_POST_THRESHOLD = 30;
const SCOPED_DISCOVERY_POST_THRESHOLD = 12;

const VIEW_HINT: Record<string, string> = {
  list: "按发布时间排序",
  card: "网格速览",
  tag: "按标签筛选",
  topic: "按主题浏览",
};

export default async function ForumPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const isLoggedIn = !!session?.user;
  const view = ["list", "card", "tag", "topic"].includes(searchParams.view ?? "")
    ? (searchParams.view as string)
    : "list";
  const activeTag = searchParams.tag;
  const activeTopic = searchParams.topic;

  const sections = await db.section.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { posts: true } } },
  });

  const tagsRaw = await db.tag.findMany({
    include: { _count: { select: { posts: true } } },
  });
  const tags = tagsRaw
    .map((t) => ({ id: t.id, name: t.name, count: t._count.posts }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);

  const where: Prisma.PostWhereInput = {};
  if (view === "tag" && activeTag) where.tags = { some: { name: activeTag } };
  if (view === "topic" && activeTopic) where.sectionId = activeTopic;

  const isTopicGrid = view === "topic" && !activeTopic;
  const totalPosts = sections.reduce((sum, s) => sum + s._count.posts, 0);
  const scopedPostCount =
    view === "tag" && activeTag
      ? tags.find((tag) => tag.name === activeTag)?.count ?? 0
      : view === "topic" && activeTopic
        ? sections.find((section) => section.id === activeTopic)?._count.posts ?? 0
        : totalPosts;
  const discoveryEnabled =
    (view === "list" && totalPosts >= GLOBAL_DISCOVERY_POST_THRESHOLD) ||
    (view === "tag" &&
      Boolean(activeTag) &&
      scopedPostCount >= SCOPED_DISCOVERY_POST_THRESHOLD) ||
    (view === "topic" &&
      Boolean(activeTopic) &&
      scopedPostCount >= SCOPED_DISCOVERY_POST_THRESHOLD);
  const discoveryScope =
    view === "tag" && activeTag
      ? { tagName: activeTag }
      : view === "topic" && activeTopic
        ? { sectionId: activeTopic }
        : {};
  const { activePosts, hotPosts } = await getForumDiscoveryPosts({
    enabled: discoveryEnabled,
    where,
    scope: discoveryScope,
  });

  const posts = isTopicGrid
    ? []
    : await db.post.findMany({
        where,
        take: 40,
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        include: {
          author: { select: { name: true } },
          section: { select: { id: true, name: true, icon: true } },
          tags: { select: { id: true, name: true } },
          _count: { select: { replies: true, favorites: true } },
        },
      });

  const activeTopicSection = activeTopic
    ? sections.find((s) => s.id === activeTopic)
    : null;

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <div className="container mx-auto max-w-6xl px-4 pb-20">
        <section className="flex flex-wrap items-end justify-between gap-6 border-b border-border py-10 md:py-14">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
              NJU Know · 校园知识社区
            </p>
            <h1 className="mt-4 text-5xl font-bold leading-[0.9] tracking-tight text-foreground sm:text-6xl md:text-8xl">
              知南
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ViewSwitcher current={view} />
            <span className="inline-flex h-9 items-center border border-border px-4 text-sm tabular-nums text-muted-foreground">
              {totalPosts} 帖
            </span>
            <Button asChild size="sm" className="h-9 rounded-none">
              <Link href="/forum/new">
                <PenSquare className="mr-2 h-4 w-4" />
                发帖
              </Link>
            </Button>
          </div>
        </section>

        <form
          action="/search"
          method="get"
          className="flex items-center gap-3 border-b border-border py-4"
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="search"
            name="q"
            placeholder="搜索帖子、用户…"
            aria-label="搜索帖子或用户"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </form>

        <section className="flex items-baseline justify-between gap-3 border-b border-border py-4">
          <h2 className="section-label">
            {view === "list" && "最新帖子"}
            {view === "card" && "卡片浏览"}
            {view === "tag" && "标签"}
            {view === "topic" && (activeTopicSection ? "主题" : "全部主题")}
          </h2>
          <span className="text-xs text-muted-foreground">{VIEW_HINT[view]}</span>
        </section>

        {(activeTag || activeTopicSection) && (
          <div className="flex items-center gap-3 border-b border-border py-4 text-sm">
            <span className="text-muted-foreground">
              {activeTag ? "标签" : "主题"} ·{" "}
              <span className="font-medium text-foreground">
                {activeTag ?? activeTopicSection?.name}
              </span>
            </span>
            <Link
              href={activeTag ? "/forum?view=tag" : "/forum?view=topic"}
              scroll={false}
              className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              清除
            </Link>
          </div>
        )}

        <div key={view} className="mt-8 animate-view">
          <ForumDiscoverySection activePosts={activePosts} hotPosts={hotPosts} />

          {view === "list" && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
                <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  实时动态
                </h3>
              </div>
              {(isLoggedIn ? posts : posts.slice(0, 4)).map((post, i) => (
                <PostListRow key={post.id} post={post} index={i} />
              ))}
              {!isLoggedIn && posts.length > 4 && <LoginGate />}
            </div>
          )}

          {view === "card" && (
            <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
              {(isLoggedIn ? posts : posts.slice(0, 3)).map((post, i) => (
                <div key={post.id} className="bg-background">
                  <PostCard post={post} index={i} />
                </div>
              ))}
            </div>
          )}
          {view === "card" && !isLoggedIn && posts.length > 3 && <LoginGate />}

          {view === "tag" && (
            <div className="space-y-8">
              <TagCloud tags={tags} total={totalPosts} activeTag={activeTag} />
              <div className="border-t border-border">
                {(isLoggedIn ? posts : posts.slice(0, 4)).map((post, i) => (
                  <PostListRow key={post.id} post={post} index={i} />
                ))}
                {!isLoggedIn && posts.length > 4 && <LoginGate />}
              </div>
            </div>
          )}

          {view === "topic" && isTopicGrid && (
            <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
              {sections.map((s) => (
                <div key={s.id} className="bg-background">
                  <TopicCard
                    topic={{
                      id: s.id,
                      name: s.name,
                      description: s.description,
                      icon: s.icon,
                      count: s._count.posts,
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {view === "topic" && !isTopicGrid && (
            <div className="border-t border-border">
              {(isLoggedIn ? posts : posts.slice(0, 4)).map((post, i) => (
                <PostListRow key={post.id} post={post} index={i} />
              ))}
              {!isLoggedIn && posts.length > 4 && <LoginGate />}
            </div>
          )}

          {!isTopicGrid && posts.length === 0 && (
            <div className="flex flex-col items-center gap-3 border border-dashed border-border py-20 text-center">
              <PenSquare className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">暂无帖子</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeTag || activeTopicSection
                    ? "该筛选下还没有内容。"
                    : "发布第一条校园讨论。"}
                </p>
              </div>
              <Button asChild className="rounded-none">
                <Link href="/forum/new">发帖</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
