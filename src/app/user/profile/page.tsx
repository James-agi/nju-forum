import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { Calendar, MessageSquare, BookOpen, Heart } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <SectionLabel en="Profile · 个人中心" zh="个人中心" />
      <div className="mt-8 animate-fade-in">
        <Card>
          <CardContent className="p-8">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-20 w-20 border border-border">
                <AvatarFallback className="text-2xl">
                  {user.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <h1 className="mt-4 text-2xl font-bold">{user.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-3">
                <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                  {user.role === "ADMIN" ? "管理员" : "用户"}
                </Badge>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-border pt-8 text-center">
              <div>
                <BookOpen className="mx-auto h-5 w-5 text-muted-foreground mb-2" />
                <p className="text-3xl font-bold tabular-nums tracking-tight">{user._count.posts}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.15em] text-muted-foreground">帖子</p>
              </div>
              <div>
                <MessageSquare className="mx-auto h-5 w-5 text-muted-foreground mb-2" />
                <p className="text-3xl font-bold tabular-nums tracking-tight">{user._count.replies}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.15em] text-muted-foreground">回复</p>
              </div>
              <div>
                <Heart className="mx-auto h-5 w-5 text-muted-foreground mb-2" />
                <p className="text-3xl font-bold tabular-nums tracking-tight">{user._count.favorites}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.15em] text-muted-foreground">收藏</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              注册于 {new Date(user.createdAt).toLocaleDateString("zh-CN")}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
