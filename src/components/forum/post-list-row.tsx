import Link from "next/link";
import { Heart, MessageSquare, Pin } from "lucide-react";

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
  const compact = content.replace(/\s+/g, " ").trim();
  if (compact.length <= 140) return compact;
  return `${compact.slice(0, 140)}...`;
}

export function PostListRow({ post, index }: PostListRowProps) {
  return (
    <Link
      href={`/forum/post/${post.id}`}
      style={{ "--index": index } as React.CSSProperties}
      className="animate-stagger group grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 border-b border-border py-4 transition-colors hover:bg-muted/20 md:gap-6"
    >
      <span className="text-xs font-medium tabular-nums tracking-[0.2em] text-muted-foreground/60">
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {post.pinned && (
            <Pin className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--status-progress))]" />
          )}
          <h3 className="text-lg font-semibold leading-tight tracking-tight text-foreground md:text-xl">
            {post.title}
          </h3>
        </div>
        <p className="mt-1.5 line-clamp-1 text-sm leading-5 text-muted-foreground">
          {getPreview(post.content)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">{post.author.name}</span>
          {post.section && (
            <span className="text-muted-foreground/80">
              {post.section.icon} {post.section.name}
            </span>
          )}
          {post.tags.slice(0, 3).map((tag) => (
            <span key={tag.id}>#{tag.name}</span>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4 text-xs tabular-nums text-muted-foreground/70">
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {post._count.replies}
        </span>
        <span className="inline-flex items-center gap-1">
          <Heart className="h-3 w-3" />
          {post._count.favorites}
        </span>
        <time className="text-muted-foreground/60">
          {new Date(post.createdAt).toLocaleDateString("zh-CN")}
        </time>
      </div>
    </Link>
  );
}
