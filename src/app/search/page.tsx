import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-utils";
import { searchForum } from "@/lib/forum/search";
import { PostListRow } from "@/components/forum/post-list-row";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const resolvedSearchParams = await searchParams;
  const q = (resolvedSearchParams.q ?? "").trim();
  const { posts, users } = q
    ? await searchForum(q, { isAdmin: user.role === "ADMIN" })
    : { posts: [], users: [] };
  const hasQuery = q.length > 0;
  const empty = hasQuery && posts.length === 0 && users.length === 0;

  return (
    <div className="container mx-auto max-w-4xl px-4 pb-20 pt-8">
      <form action="/search" method="get" className="flex items-center gap-3 border-b border-border pb-4">
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="搜索帖子、用户…"
          aria-label="搜索帖子或用户"
          className="w-full bg-transparent text-lg text-foreground outline-none placeholder:text-muted-foreground"
        />
      </form>

      {!hasQuery && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          输入关键词，搜索论坛里的帖子和用户。
        </p>
      )}

      {empty && (
        <div className="mt-10 flex flex-col items-center gap-2 border border-dashed border-border py-16 text-center">
          <Search className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium text-foreground">没有找到与「{q}」相关的内容</p>
          <p className="text-sm text-muted-foreground">换个关键词试试。</p>
        </div>
      )}

      {hasQuery && users.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="section-label">用户 · {users.length}</h2>
          </div>
          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
            {users.map((u) => (
              <Link
                key={u.id}
                href={`/user/${u.id}`}
                className="flex items-center gap-3 bg-background p-4 transition-colors hover:bg-muted/30"
              >
                <Avatar className="h-10 w-10 border border-border">
                  <AvatarImage src={u.avatar ?? undefined} alt={u.name} />
                  <AvatarFallback>{u.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{u.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {u._count.posts} 帖
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {hasQuery && posts.length > 0 && (
        <section className="mt-10">
          <div className="mb-1 flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <h2 className="section-label">帖子 · {posts.length}</h2>
          </div>
          <div>
            {posts.map((post, i) => (
              <PostListRow key={post.id} post={post} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
