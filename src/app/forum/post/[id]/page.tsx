import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Eye, Clock, MessageSquare, Heart, ArrowLeft } from "lucide-react";
import { ReplyForm } from "@/components/forum/reply-form";
import { ReplyList } from "@/components/forum/reply-list";
import { FavoriteButton } from "@/components/forum/favorite-button";
import { LoginGate } from "@/components/auth/login-gate";
import { PostExitKey } from "@/components/forum/post-exit-key";
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

  const tagIds = post.tags.map((t) => t.id);
  const relatedPostFilters =
    tagIds.length > 0
      ? [{ tags: { some: { id: { in: tagIds } } } }, { sectionId: post.sectionId }]
      : [{ sectionId: post.sectionId }];
  const relatedPosts = await db.post.findMany({
    where: {
      id: { not: post.id },
      OR: relatedPostFilters,
    },
    take: 5,
    orderBy: [{ replyCount: "desc" }, { createdAt: "desc" }],
    include: {
      section: { select: { name: true, icon: true } },
      _count: { select: { replies: true } },
    },
  });

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <PostExitKey />
      <div className="mb-6">
        <Link
          href="/forum"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回论坛
        </Link>
      </div>

      <article className="animate-fade-in">
        <header className="border-b border-border pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {post.section.icon} {post.section.name}
            </Badge>
            {post.tags.map((tag) => (
              <Badge key={tag.id} variant="secondary">{tag.name}</Badge>
            ))}
          </div>

          <h1 className="mt-4 text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl">
            {post.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{post.author.name}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {new Date(post.createdAt).toLocaleString("zh-CN")}
            </span>
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
        </header>

        <div className="py-8">
          <div className="prose prose-sm max-w-none dark:prose-invert leading-7">
            {session?.user ? (
              post.content.split("\n").map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))
            ) : (
              <>
                {post.content.split("\n").slice(0, 2).map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
                <div className="relative">
                  <p className="line-clamp-2 text-muted-foreground/60">
                    {post.content.split("\n").slice(2, 4).join(" ")}
                  </p>
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-background" />
                </div>
              </>
            )}
          </div>
          {!session?.user && (
            <div className="mt-2">
              <div className="border border-dashed border-border/60 bg-muted/20 px-5 py-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">▪ 后续为登录内容</span>
                <span className="mx-2">·</span>
                完整收录：{post.title}
              </div>
              <LoginGate />
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border py-4">
          <FavoriteButton
            postId={post.id}
            initialFavorited={isFavorited}
            canFavorite={Boolean(session?.user)}
          />
        </div>
      </article>

      <Separator className="my-8" />

      <section className="animate-slide-up">
        <h2 className="section-label">
          回复 ({post._count.replies})
        </h2>
        <div className="mt-4">
          <ReplyList replies={replies} postId={post.id} />
        </div>
      </section>

      <div className="mt-8 border-t border-border pt-8">
        <ReplyForm postId={post.id} canReply={Boolean(session?.user)} />
      </div>

      {relatedPosts.length > 0 && (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="section-label">相关推荐</h2>
          <div className="mt-4 border-t border-border">
            {relatedPosts.map((rp) => (
              <Link
                key={rp.id}
                href={`/forum/post/${rp.id}`}
                className="group flex items-center gap-4 border-b border-border py-4 transition-colors hover:bg-muted/30"
              >
                <span className="text-xs text-muted-foreground">
                  {rp.section.icon} {rp.section.name}
                </span>
                <span className="flex-1 truncate text-sm text-foreground">
                  {rp.title}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {rp._count.replies}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
