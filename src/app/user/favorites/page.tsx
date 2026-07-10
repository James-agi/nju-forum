import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { Clock, Heart } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UserFavoritesPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const favorites = await db.favorite.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      post: {
        include: {
          author: { select: { id: true, name: true } },
          section: { select: { id: true, name: true, icon: true } },
          _count: { select: { replies: true, favorites: true } },
        },
      },
    },
  });

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <SectionLabel en="User · 我的收藏" zh="我的收藏" />
      <div className="mt-8 space-y-3 animate-fade-in">
        {favorites.map((fav) => (
          <Link key={fav.id} href={`/forum/post/${fav.postId}`}>
            <Card className="transition-colors hover:bg-muted/30 cursor-pointer border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px]">
                    {fav.post.section.icon} {fav.post.section.name}
                  </Badge>
                </div>
                <h3 className="font-medium truncate">{fav.post.title}</h3>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{fav.post.author.name}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(fav.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    {fav.post._count.favorites}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {favorites.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              你还没有收藏过帖子
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
