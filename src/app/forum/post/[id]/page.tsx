import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Eye, Clock, MessageSquare, Heart } from "lucide-react";
import { ReplyForm } from "@/components/forum/reply-form";
import { ReplyList } from "@/components/forum/reply-list";
import { FavoriteButton } from "@/components/forum/favorite-button";
import { getSession } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

interface PostPageProps {
  params: { id: string };
}

export default async function PostPage({ params }: PostPageProps) {
  const session = await getSession();

  const post = await db.post.update({
    where: { id: params.id },
    data: { viewCount: { increment: 1 } },
    include: {
      author: { select: { id: true, name: true, avatar: true, createdAt: true } },
      section: { select: { id: true, name: true, icon: true } },
      tags: { select: { id: true, name: true } },
      _count: { select: { replies: true, favorites: true } },
    },
  });

  if (!post) notFound();

  const replies = await db.reply.findMany({
    where: { postId: params.id, parentId: null },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      children: {
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          children: {
            include: {
              author: { select: { id: true, name: true, avatar: true } },
            },
          },
        },
      },
    },
  });

  let isFavorited = false;
  if (session?.user) {
    const fav = await db.favorite.findUnique({
      where: { userId_postId: { userId: session.user.id, postId: params.id } },
    });
    isFavorited = !!fav;
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline">
              {post.section.icon} {post.section.name}
            </Badge>
            {post.tags.map((tag) => (
              <Badge key={tag.id} variant="secondary">{tag.name}</Badge>
            ))}
          </div>
          <h1 className="text-2xl font-bold">{post.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{post.author.name}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {new Date(post.createdAt).toLocaleString("zh-CN")}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {post.viewCount}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              {post._count.replies}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-4 w-4" />
              {post._count.favorites}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none dark:prose-invert mb-6">
            {post.content.split("\n").map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>

          {session?.user && (
            <FavoriteButton postId={post.id} initialFavorited={isFavorited} />
          )}
        </CardContent>
      </Card>

      <Separator className="my-6" />

      <div className="mb-6">
        <h2 className="text-lg font-bold mb-4">
          回复 ({post._count.replies})
        </h2>
        <ReplyList replies={replies} postId={post.id} />
      </div>

      {session?.user ? (
        <Card>
          <CardContent className="p-4">
            <ReplyForm postId={post.id} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 text-center text-muted-foreground">
            请先登录后再回复
          </CardContent>
        </Card>
      )}
    </div>
  );
}
