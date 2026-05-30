import Link from "next/link";
import { Clock, Eye, Heart, MessageSquare, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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
    <Link href={`/forum/post/${post.id}`} className="block">
      <Card className="border-border/80 transition-colors hover:border-foreground/20 hover:bg-muted/30">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {post.pinned && (
                <Badge variant="secondary" className="gap-1">
                  <Pin className="h-3 w-3" />
                  置顶
                </Badge>
              )}
              {showSection && post.section && (
                <Badge variant="outline">
                  {post.section.icon} {post.section.name}
                </Badge>
              )}
              {post.tags.slice(0, 3).map((tag) => (
                <Badge key={tag.id} variant="secondary">
                  {tag.name}
                </Badge>
              ))}
            </div>

            <div className="space-y-1">
              <h3 className="line-clamp-2 text-base font-semibold leading-6">
                {post.title}
              </h3>
              <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                {getPreview(post.content)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{post.author.name}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {new Date(post.createdAt).toLocaleDateString("zh-CN")}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {post.viewCount}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {post._count.replies}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="h-3.5 w-3.5" />
                {post._count.favorites}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
