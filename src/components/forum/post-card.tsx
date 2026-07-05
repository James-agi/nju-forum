import Link from "next/link";
import { Heart, MessageSquare, Pin } from "lucide-react";
import { getPostTextPreview } from "@/lib/forum/post-preview";

interface PostCardProps {
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
  if (compact.length <= 90) return compact;
  return `${compact.slice(0, 90)}...`;
}

export function PostCard({ post, index }: PostCardProps) {
  return (
    <Link
      href={`/forum/post/${post.id}`}
      className="frame-card glow-hover group flex h-full flex-col border border-border p-5 transition-colors hover:bg-muted/20"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tabular-nums tracking-[0.2em] text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
        {post.pinned && (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--status-progress))]">
            <Pin className="h-3 w-3" />
            置顶
          </span>
        )}
      </div>

      <h3 className="mt-4 line-clamp-2 text-xl font-bold leading-7 tracking-tight text-foreground">
        {post.title}
      </h3>
      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">
        {getPreview(post.content)}
      </p>

      {post.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {post.tags.slice(0, 3).map((tag) => (
            <span key={tag.id}>#{tag.name}</span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {post._count.replies}
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" />
            {post._count.favorites}
          </span>
        </div>
        <time className="tabular-nums text-muted-foreground/60">
          {new Date(post.createdAt).toLocaleDateString("zh-CN")}
        </time>
      </div>
    </Link>
  );
}
