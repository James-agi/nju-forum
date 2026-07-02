import Link from "next/link";
import { Eye, Heart, MessageSquare, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  const compact = content.replace(/\s+/g, " ").trim();
  if (compact.length <= 120) return compact;
  return `${compact.slice(0, 120)}...`;
}

export function PostListItem({ post, showSection = true }: PostListItemProps) {
  return (
    <Link
      href={`/forum/post/${post.id}`}
      className="group block border-b border-border px-0 py-4 transition-colors hover:bg-muted/20"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          {(post.pinned || (showSection && post.section) || post.tags.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {post.pinned && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <Pin className="h-3 w-3" />
                  置顶
                </Badge>
              )}
              {showSection && post.section && (
                <Badge variant="outline" className="text-[10px]">
                  {post.section.icon} {post.section.name}
                </Badge>
              )}
              {post.tags.slice(0, 3).map((tag) => (
                <Badge key={tag.id} variant="secondary" className="text-[10px]">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          <h3 className="line-clamp-2 text-base font-semibold leading-6 text-foreground">
            {post.title}
          </h3>
          <p className="line-clamp-1 text-sm leading-6 text-muted-foreground">
            {getPreview(post.content)}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{post.author.name}</span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {post.viewCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {post._count.replies}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              {post._count.favorites}
            </span>
          </div>
        </div>

        <time className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground/60">
          {new Date(post.createdAt).toLocaleDateString("zh-CN")}
        </time>
      </div>
    </Link>
  );
}
