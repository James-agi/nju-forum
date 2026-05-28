import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Eye, Clock, PenSquare } from "lucide-react";

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

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {section.icon} {section.name}
          </h1>
          {section.description && (
            <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
          )}
        </div>
        <Button asChild>
          <Link href="/forum/new">
            <PenSquare className="mr-2 h-4 w-4" />
            发帖
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
        {posts.map((post) => (
          <Link key={post.id} href={`/forum/post/${post.id}`}>
            <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {post.pinned && (
                        <Badge variant="secondary" className="text-xs">置顶</Badge>
                      )}
                      {post.tags.map((tag) => (
                        <Badge key={tag.id} variant="secondary" className="text-xs">
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                    <h3 className="font-medium truncate">{post.title}</h3>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {post.content.substring(0, 120)}...
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{post.author.name}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(post.createdAt).toLocaleDateString("zh-CN")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {post.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {post._count.replies}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {posts.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              该分区暂无帖子
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
