import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Eye, MessageSquare } from "lucide-react";

export default async function UserPostsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const posts = await db.post.findMany({
    where: { authorId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      section: { select: { id: true, name: true, icon: true } },
      _count: { select: { replies: true, favorites: true } },
    },
  });

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">我的帖子</h1>
      <div className="space-y-3">
        {posts.map((post) => (
          <Link key={post.id} href={`/forum/post/${post.id}`}>
            <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    {post.section.icon} {post.section.name}
                  </Badge>
                </div>
                <h3 className="font-medium truncate">{post.title}</h3>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
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
              </CardContent>
            </Card>
          </Link>
        ))}
        {posts.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              你还没有发过帖子
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
