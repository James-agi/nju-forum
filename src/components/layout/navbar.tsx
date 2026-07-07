"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/forum/theme-toggle";
import {
  BookOpen,
  HelpCircle,
  Inbox,
  Library,
  LogOut,
  Menu,
  MessageSquare,
  PenSquare,
  Search,
  Settings,
  User,
} from "lucide-react";

const iconBox =
  "inline-flex h-8 w-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground";

const drawerRow =
  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted";

export function Navbar() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const user = session?.user;
  const isAdmin = user?.role === "ADMIN";
  const avatarSrc = user?.avatar ?? undefined;

  return (
    <header className="sticky top-0 z-50 px-4 pt-3">
      <div className="container mx-auto flex h-12 items-center justify-between rounded-2xl border border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <BookOpen className="h-5 w-5" />
          知南
        </Link>

        {/* 桌面端导航 */}
        <nav className="hidden items-center gap-2 md:flex">
          <Link href="/search" aria-label="搜索" title="搜索" className={iconBox}>
            <Search className="h-4 w-4" />
          </Link>
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/knowledge">
              <HelpCircle className="mr-2 h-4 w-4" />
              知识问答
            </Link>
          </Button>
          {status === "loading" ? (
            <div className="h-8 w-16 animate-pulse rounded bg-muted" />
          ) : user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/forum/new">
                  <PenSquare className="mr-2 h-4 w-4" />
                  发帖
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={avatarSrc} alt={user.name ?? ""} />
                      <AvatarFallback>
                        {user.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="flex items-center gap-2 p-2">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/user/profile">
                      <User className="mr-2 h-4 w-4" />
                      个人中心
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/user/posts">
                      <BookOpen className="mr-2 h-4 w-4" />
                      我的帖子
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/feedback">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      意见反馈
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin">
                          <Settings className="mr-2 h-4 w-4" />
                          管理后台
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/knowledge">
                          <Library className="mr-2 h-4 w-4" />
                          知识卡片
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/gaps">
                          <Inbox className="mr-2 h-4 w-4" />
                          缺口库
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/feedback">
                          <MessageSquare className="mr-2 h-4 w-4" />
                          反馈管理
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
                    <LogOut className="mr-2 h-4 w-4" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">登录</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">注册</Link>
              </Button>
            </>
          )}
        </nav>

        {/* 移动端：主题切换 + 汉堡抽屉 */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button type="button" aria-label="菜单" className={iconBox}>
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-4">
              <div className="mt-2 flex flex-col gap-1">
                {user && (
                  <div className="mb-2 flex items-center gap-3 border-b border-border px-1 pb-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={avatarSrc} alt={user.name ?? ""} />
                      <AvatarFallback>{user.name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                )}

                <SheetClose asChild>
                  <Link href="/search" className={drawerRow}>
                    <Search className="h-4 w-4" />
                    搜索
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/knowledge" className={drawerRow}>
                    <HelpCircle className="h-4 w-4" />
                    知识问答
                  </Link>
                </SheetClose>

                {user ? (
                  <>
                    <SheetClose asChild>
                      <Link href="/forum/new" className={drawerRow}>
                        <PenSquare className="h-4 w-4" />
                        发帖
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href="/user/profile" className={drawerRow}>
                        <User className="h-4 w-4" />
                        个人中心
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href="/user/posts" className={drawerRow}>
                        <BookOpen className="h-4 w-4" />
                        我的帖子
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href="/feedback" className={drawerRow}>
                        <MessageSquare className="h-4 w-4" />
                        意见反馈
                      </Link>
                    </SheetClose>

                    {isAdmin && (
                      <>
                        <div className="my-1 border-t border-border" />
                        <SheetClose asChild>
                          <Link href="/admin" className={drawerRow}>
                            <Settings className="h-4 w-4" />
                            管理后台
                          </Link>
                        </SheetClose>
                        <SheetClose asChild>
                          <Link href="/admin/knowledge" className={drawerRow}>
                            <Library className="h-4 w-4" />
                            知识卡片
                          </Link>
                        </SheetClose>
                        <SheetClose asChild>
                          <Link href="/admin/gaps" className={drawerRow}>
                            <Inbox className="h-4 w-4" />
                            缺口库
                          </Link>
                        </SheetClose>
                        <SheetClose asChild>
                          <Link href="/admin/feedback" className={drawerRow}>
                            <MessageSquare className="h-4 w-4" />
                            反馈管理
                          </Link>
                        </SheetClose>
                      </>
                    )}

                    <div className="my-1 border-t border-border" />
                    <button
                      type="button"
                      className={`${drawerRow} w-full text-left`}
                      onClick={() => {
                        setOpen(false);
                        signOut({ callbackUrl: "/" });
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      退出登录
                    </button>
                  </>
                ) : (
                  <>
                    <div className="my-1 border-t border-border" />
                    <SheetClose asChild>
                      <Link href="/login" className={drawerRow}>
                        <User className="h-4 w-4" />
                        登录
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href="/register" className={drawerRow}>
                        <PenSquare className="h-4 w-4" />
                        注册
                      </Link>
                    </SheetClose>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
