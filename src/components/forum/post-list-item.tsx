import Link from "next/link";
import { Pin } from "lucide-react";
import { getPostTextPreview } from "@/lib/forum/post-preview";
import { PostStats } from "@/components/forum/post-stats";

interface PostListItemProps {
  post: {
    id: string;
    title: string;
    content: string;
    pinned: boolean;
    viewCount: number;
    createdAt: Date;
    author: {
      name: string;
    };
    section?: {
      id: string;
      name: string;
      icon: string | null;
    };
    tags: Array<{
      id: string;
      name: string;
    }>;
    _count: {
      replies: number;
      favorites: number;
    };
  };
  showSection?: boolean;
}

function getPreview(content: string) {
  const compact = getPostTextPreview(content, 4).replace(/\s+/g, " ").trim();
  if (compact.length <= 120) return compact;
  return `${compact.slice(0, 120)}...`;
}

export function PostListItem({ post, showSection = true }: PostListItemProps) {
  return (
    <Link
      href={`/forum/post/${post.id}`}
      className="group grid grid-cols-[1fr_auto] items-baseline gap-3 border-b border-border py-3 transition-colors hover:bg-muted/20 md:items-center md:gap-6 md:py-4"
    >
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
          {showSection && post.section && (
            <span className="text-muted-foreground/80">
              {post.section.icon} {post.section.name}
            </span>
          )}
          {post.tags.slice(0, 3).map((tag) => (
            <span key={tag.id}>#{tag.name}</span>
          ))}
          {/* 窄屏：统计折进 meta 行 */}
          <PostStats
            views={post.viewCount}
            replies={post._count.replies}
            favorites={post._count.favorites}
            createdAt={post.createdAt}
            className="flex md:hidden"
          />
        </div>
      </div>

      {/* 宽屏：右侧独立对齐列 */}
      <PostStats
        views={post.viewCount}
        replies={post._count.replies}
        favorites={post._count.favorites}
        createdAt={post.createdAt}
        className="hidden shrink-0 md:flex"
      />
    </Link>
  );
}
