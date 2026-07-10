import Link from "next/link";
import type { CSSProperties } from "react";
import type { ForumDiscoveryPost } from "@/lib/forum/post-metrics";

interface ForumDiscoverySectionProps {
  activePosts: ForumDiscoveryPost[];
  hotPosts: ForumDiscoveryPost[];
}

function DiscoveryCard({
  post,
  index,
  tone,
}: {
  post: ForumDiscoveryPost;
  index: number;
  tone: "active" | "hot";
}) {
  const metric =
    tone === "active"
      ? `${post._recentReplyCount ?? 0} 条新讨论`
      : `${post._count.favorites + post._count.replies} 热度`;
  const metricClass = tone === "active" ? "text-sky-400/80" : "text-orange-400/80";

  return (
    <Link
      href={`/forum/post/${post.id}`}
      style={{ "--index": index } as CSSProperties}
      className="animate-stagger glow-hover group flex flex-col gap-2 border border-border p-4 transition-all hover:border-foreground/30 hover:bg-muted/30"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{post.section?.icon}</span>
        <span>{post.section?.name}</span>
        <span className={`ml-auto tabular-nums ${metricClass}`}>{metric}</span>
      </div>
      <h3 className="text-sm font-semibold leading-tight text-foreground transition-colors">
        {post.title}
      </h3>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{post.author.name}</span>
        <span>{new Date(post.createdAt).toLocaleDateString("zh-CN")}</span>
        <span>{post._count.replies} 回复</span>
        <span>{post._count.favorites} 收藏</span>
      </div>
    </Link>
  );
}

export function ForumDiscoverySection({
  activePosts,
  hotPosts,
}: ForumDiscoverySectionProps) {
  if (activePosts.length === 0 && hotPosts.length === 0) return null;

  return (
    <div className="mb-10 grid gap-6 lg:grid-cols-2">
      {activePosts.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-500" />
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              正在讨论
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {activePosts.map((post, index) => (
              <DiscoveryCard key={post.id} post={post} index={index} tone="active" />
            ))}
          </div>
        </section>
      )}

      {hotPosts.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-orange-500" />
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              精选热帖
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {hotPosts.map((post, index) => (
              <DiscoveryCard key={post.id} post={post} index={index} tone="hot" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
