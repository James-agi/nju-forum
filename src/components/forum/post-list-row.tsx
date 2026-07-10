import Link from "next/link";
import { Pin } from "lucide-react";
import { getPostTextPreview } from "@/lib/forum/post-preview";
import { PostStats } from "@/components/forum/post-stats";

interface PostListRowProps {
  post: {
    id: string;
    title: string;
    content: string;
    pinned: boolean;
    createdAt: Date;
    author: { name: string };
    section?: { id: string; name: string; icon: string | null } | null;
    tags: Array<{ id: string; name: string }>;
    _count: { replies: number; favorites: number };
  };
  index: number;
}

function getPreview(content: string) {
  const compact = getPostTextPreview(content, 4).replace(/\s+/g, " ").trim();
  if (compact.length <= 140) return compact;
  return `${compact.slice(0, 140)}...`;
}

export function PostListRow({ post, index }: PostListRowProps) {
  return (
    <Link
      href={`/forum/post/${post.id}`}
      style={{ "--index": index } as React.CSSProperties}
      className="animate-stagger group grid grid-cols-[1.75rem_1fr] items-baseline gap-3 border-b border-border py-3 transition-colors hover:bg-muted/20 md:grid-cols-[2.5rem_1fr_auto] md:items-center md:gap-6 md:py-4"
    >
      <span className="text-xs font-medium tabular-nums tracking-[0.2em] text-muted-foreground/60">
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {post.pinned && (
            <Pin className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--status-progress))]" />
          )}
          <h3 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight text-foreground md:text-lg">
            {post.title}
          </h3>
        </div>
        <p className="mt-1 line-clamp-1 text-sm leading-5 text-muted-foreground">
          {getPreview(post.content)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">{post.author.name}</span>
          {post.section && (
            <span className="text-muted-foreground/80">
              {post.section.icon} {post.section.name}
            </span>
          )}
          {post.tags.slice(0, 3).map((tag) => (
            <span key={tag.id}>#{tag.name}</span>
          ))}
          {/* 窄屏：统计折进 meta 行 */}
          <PostStats
            replies={post._count.replies}
            favorites={post._count.favorites}
            createdAt={post.createdAt}
            className="flex md:hidden"
          />
        </div>
      </div>

      {/* 宽屏：右侧独立对齐列 */}
      <PostStats
        replies={post._count.replies}
        favorites={post._count.favorites}
        createdAt={post.createdAt}
        className="hidden shrink-0 md:flex"
      />
    </Link>
  );
}
