import { notFound, redirect } from "next/navigation";
import { Calendar, BookOpen } from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PostListRow } from "@/components/forum/post-list-row";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  // 自己的主页跳转到个人中心
  if (session.user.id === id) redirect("/user/profile");

  const profile = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      avatar: true,
      createdAt: true,
      banned: true,
      _count: { select: { posts: true } },
    },
  });
  if (!profile || profile.banned) notFound();

  const posts = await db.post.findMany({
    where: { authorId: profile.id },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 30,
    include: {
      author: { select: { name: true } },
      section: { select: { id: true, name: true, icon: true } },
      tags: { select: { id: true, name: true } },
      _count: { select: { replies: true, favorites: true } },
    },
  });

  return (
    <div className="container mx-auto max-w-4xl px-4 pb-20 pt-8">
      <div className="flex items-center gap-4 border-b border-border pb-8">
        <Avatar className="h-16 w-16 border border-border sm:h-20 sm:w-20">
          <AvatarImage src={profile.avatar ?? undefined} alt={profile.name} />
          <AvatarFallback className="text-2xl">{profile.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{profile.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              {profile._count.posts} 帖
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              注册于 {new Date(profile.createdAt).toLocaleDateString("zh-CN")}
            </span>
          </div>
        </div>
      </div>

      <h2 className="section-label mt-8">TA 的帖子</h2>
      <div className="mt-4">
        {posts.length === 0 ? (
          <div className="border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            还没有发过帖子。
          </div>
        ) : (
          posts.map((post, i) => <PostListRow key={post.id} post={post} index={i} />)
        )}
      </div>
    </div>
  );
}
