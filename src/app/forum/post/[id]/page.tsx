import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Eye, Heart, MessageSquare } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ReplyForm } from "@/components/forum/reply-form";
import { ReplyList } from "@/components/forum/reply-list";
import { FavoriteButton } from "@/components/forum/favorite-button";
import { LoginGate } from "@/components/auth/login-gate";
import { PostExitKey } from "@/components/forum/post-exit-key";
import { PostContent } from "@/components/forum/post-content";
import { getSession } from "@/lib/auth-utils";
import { getStoredPostContentFormat } from "@/lib/forum/content-format";
import { getPostTextPreview } from "@/lib/forum/post-preview";

export const dynamic = "force-dynamic";

interface PostPageProps {
  params: { id: string };
}

export default async function PostPage({ params }: PostPageProps) {
  const session = await getSession();

  const post = await db.post.findUnique({
    where: { id: params.id },
    include: {
      author: { select: { id: true, name: true, avatar: true, createdAt: true } },
      section: { select: { id: true, name: true, icon: true } },
      tags: { select: { id: true, name: true } },
      _count: { select: { replies: true, favorites: true } },
    },
  });

  if (!post) notFound();

  await db.post.update({
    where: { id: params.id },
    data: { viewCount: { increment: 1 } },
  });

  const contentFormat = getStoredPostContentFormat(post.content);
  const displayViewCount = post.viewCount + 1;

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

  const tagIds = post.tags.map((tag) => tag.id);
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

  const previewText = getPostTextPreview(post.content, 4);
  const previewLines = previewText.split(/\r?\n/).filter(Boolean);

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
            {contentFormat === "markdown" && (
              <Badge variant="secondary">Markdown</Badge>
            )}
            {post.tags.map((tag) => (
              <Badge key={tag.id} variant="secondary">
                {tag.name}
              </Badge>
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
              {displayViewCount}
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
          {session?.user ? (
            <PostContent
              content={post.content}
              images={post.images}
            />
          ) : (
            <div className="space-y-4">
              <div className="space-y-3 text-sm leading-7 text-foreground md:text-base">
                {previewLines.length > 0 ? (
                  previewLines.slice(0, 3).map((line, index) => <p key={index}>{line}</p>)
                ) : (
                  <p className="text-muted-foreground">此帖包含图片，登录后查看完整内容。</p>
                )}
                <div className="relative">
                  <p className="line-clamp-2 text-muted-foreground/60">
                    {previewLines.slice(3).join(" ")}
                  </p>
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-background" />
                </div>
              </div>
              <div className="border border-dashed border-border/60 bg-muted/20 px-5 py-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">后续为登录内容</span>
                <span className="mx-2">·</span>
                完整阅读：{post.title}
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
        <h2 className="section-label">回复 ({post._count.replies})</h2>
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
            {relatedPosts.map((relatedPost) => (
              <Link
                key={relatedPost.id}
                href={`/forum/post/${relatedPost.id}`}
                className="group flex items-center gap-4 border-b border-border py-4 transition-colors hover:bg-muted/30"
              >
                <span className="text-xs text-muted-foreground">
                  {relatedPost.section.icon} {relatedPost.section.name}
                </span>
                <span className="flex-1 truncate text-sm text-foreground">
                  {relatedPost.title}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {relatedPost._count.replies}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
