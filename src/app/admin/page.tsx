import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AdminPage() {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalUsers, totalPosts, todayPosts, bannedUsers] = await Promise.all([
    db.user.count(),
    db.post.count(),
    db.post.count({ where: { createdAt: { gte: today } } }),
    db.user.count({ where: { banned: true } }),
  ]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">管理后台</h1>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">总用户数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {bannedUsers > 0 && `${bannedUsers} 人被封禁`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">总帖子数</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPosts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">今日新帖</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayPosts}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <Button asChild>
          <Link href="/admin/posts">帖子管理</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/users">用户管理</Link>
        </Button>
      </div>
    </div>
  );
}
