import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

export default async function UserRepliesPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const replies = await db.reply.findMany({
    where: { authorId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      post: { select: { id: true, title: true } },
    },
  });

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">我的回复</h1>
      <div className="space-y-3">
        {replies.map((reply) => (
          <Link key={reply.id} href={`/forum/post/${reply.postId}`}>
            <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-1">
                  回复了帖子：{reply.post.title}
                </p>
                <p className="text-sm truncate">{reply.content}</p>
                <span className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(reply.createdAt).toLocaleString("zh-CN")}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
        {replies.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              你还没有回复过帖子
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
