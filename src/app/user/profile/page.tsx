import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, MessageSquare, BookOpen, Heart } from "lucide-react";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <Card>
        <CardHeader className="text-center">
          <Avatar className="mx-auto h-20 w-20">
            <AvatarFallback className="text-2xl">
              {user.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <CardTitle className="mt-4 text-2xl">{user.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-2">
            <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
              {user.role === "ADMIN" ? "管理员" : "用户"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Separator className="my-4" />
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <BookOpen className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">{user._count.posts}</p>
              <p className="text-xs text-muted-foreground">帖子</p>
            </div>
            <div>
              <MessageSquare className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">{user._count.replies}</p>
              <p className="text-xs text-muted-foreground">回复</p>
            </div>
            <div>
              <Heart className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">{user._count.favorites}</p>
              <p className="text-xs text-muted-foreground">收藏</p>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            注册于 {new Date(user.createdAt).toLocaleDateString("zh-CN")}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
