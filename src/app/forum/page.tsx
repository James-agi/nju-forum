import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Eye, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ForumPage() {
  const sections = await db.section.findMany({
    orderBy: { order: "asc" },
    include: {
      _count: { select: { posts: true } },
    },
  });

  const recentPosts = await db.post.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      section: { select: { id: true, name: true, icon: true } },
      tags: { select: { id: true, name: true } },
      _count: { select: { replies: true, favorites: true } },
    },
  });

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-4">论坛分区</h1>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {sections.map((section) => (
            <Link key={section.id} href={`/forum/section/${section.id}`}>
              <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
                <CardContent className="flex flex-col items-center p-4 text-center">
                  <span className="text-3xl mb-2">{section.icon || "📌"}</span>
                  <span className="font-medium">{section.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {section._count.posts} 帖子
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">最新帖子</h2>
        <div className="space-y-3">
          {recentPosts.map((post) => (
            <Link key={post.id} href={`/forum/post/${post.id}`}>
              <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {post.pinned && (
                          <Badge variant="secondary" className="text-xs">置顶</Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {post.section.icon} {post.section.name}
                        </Badge>
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
          {recentPosts.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                暂无帖子，快来发第一帖吧！
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
