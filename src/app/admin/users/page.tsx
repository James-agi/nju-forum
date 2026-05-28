"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Ban, CheckCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
  createdAt: string;
  _count: { posts: number; replies: number };
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmUser, setConfirmUser] = useState<{ id: string; name: string; banned: boolean } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated" || (session?.user && session.user.role !== "ADMIN")) {
      router.push("/");
      return;
    }
    if (session?.user) fetchUsers();
  }, [session, status, router]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const toggleBan = async () => {
    if (!confirmUser) return;
    try {
      await fetch(`/api/admin/users`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: confirmUser.id, banned: !confirmUser.banned }),
      });
      setConfirmUser(null);
      fetchUsers();
    } catch {
      // ignore
    }
  };

  if (status === "loading" || loading) {
    return <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">加载中...</div>;
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">用户管理</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>昵称</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>帖子/回复</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>注册时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                      {user.role === "ADMIN" ? "管理员" : "用户"}
                    </Badge>
                  </TableCell>
                  <TableCell>{user._count.posts}/{user._count.replies}</TableCell>
                  <TableCell>
                    {user.banned ? (
                      <Badge variant="destructive">已封禁</Badge>
                    ) : (
                      <Badge variant="outline">正常</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString("zh-CN")}
                  </TableCell>
                  <TableCell className="text-right">
                    {user.role !== "ADMIN" && (
                      <Button
                        variant={user.banned ? "outline" : "destructive"}
                        size="sm"
                        onClick={() => setConfirmUser({ id: user.id, name: user.name, banned: user.banned })}
                      >
                        {user.banned ? (
                          <>
                            <CheckCircle className="mr-1 h-4 w-4" />
                            解封
                          </>
                        ) : (
                          <>
                            <Ban className="mr-1 h-4 w-4" />
                            封禁
                          </>
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {users.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">暂无用户</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!confirmUser} onOpenChange={() => setConfirmUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmUser?.banned ? "确认解封" : "确认封禁"}
            </DialogTitle>
            <DialogDescription>
              {confirmUser?.banned
                ? `确定要解封用户 "${confirmUser?.name}" 吗？`
                : `确定要封禁用户 "${confirmUser?.name}" 吗？封禁后该用户将无法登录和发帖。`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUser(null)}>取消</Button>
            <Button
              variant={confirmUser?.banned ? "default" : "destructive"}
              onClick={toggleBan}
            >
              {confirmUser?.banned ? "解封" : "封禁"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
