"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ban, CheckCircle, ArrowLeft, Gift } from "lucide-react";
import Link from "next/link";
import {
  CONTRIBUTION_TYPES,
  CONTRIBUTION_TYPE_LABELS,
  type ContributionTypeValue,
} from "@/lib/contribution";

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
  const [awardUser, setAwardUser] = useState<{ id: string; name: string } | null>(null);
  const [awardPoints, setAwardPoints] = useState("10");
  const [awardReason, setAwardReason] = useState("");
  const [awardType, setAwardType] = useState<ContributionTypeValue>("CITED");
  const [awardLoading, setAwardLoading] = useState(false);
  const [awardError, setAwardError] = useState<string | null>(null);

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

  const openAward = (user: { id: string; name: string }) => {
    setAwardUser(user);
    setAwardPoints("10");
    setAwardReason("");
    setAwardType("CITED");
    setAwardError(null);
  };

  const submitAward = async () => {
    if (!awardUser) return;
    setAwardLoading(true);
    setAwardError(null);
    try {
      const res = await fetch("/api/admin/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: awardUser.id,
          points: Number(awardPoints),
          reason: awardReason,
          type: awardType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAwardError(data.error || "授予失败");
        return;
      }
      setAwardUser(null);
    } catch {
      setAwardError("授予失败，请重试");
    } finally {
      setAwardLoading(false);
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
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAward({ id: user.id, name: user.name })}
                      >
                        <Gift className="mr-1 h-4 w-4" />
                        授予
                      </Button>
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
                    </div>
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

      <Dialog open={!!awardUser} onOpenChange={(o) => !o && setAwardUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>授予贡献值</DialogTitle>
            <DialogDescription>
              给「{awardUser?.name}」记一笔贡献。积分会累加到其等级，并在其个人页显示为贡献明细。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>贡献类型</Label>
              <Select value={awardType} onValueChange={(v) => setAwardType(v as ContributionTypeValue)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRIBUTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CONTRIBUTION_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="award-points">分值</Label>
              <Input
                id="award-points"
                type="number"
                value={awardPoints}
                onChange={(e) => setAwardPoints(e.target.value)}
                placeholder="如 10（可为负数用于修正）"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="award-reason">原因</Label>
              <Input
                id="award-reason"
                value={awardReason}
                onChange={(e) => setAwardReason(e.target.value)}
                placeholder="如：帖子《…》被收录进知识库"
                maxLength={200}
              />
            </div>
            {awardError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {awardError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAwardUser(null)}>取消</Button>
            <Button onClick={submitAward} disabled={awardLoading || !awardReason.trim()}>
              {awardLoading ? "授予中" : "确认授予"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
