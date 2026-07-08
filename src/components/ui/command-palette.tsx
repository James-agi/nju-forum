"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, Hash, Sun, Moon, PenSquare, User, MessageSquare, Inbox, Users } from "lucide-react";
import {
  getAppliedTheme,
  listenThemeChange,
  toggleStoredTheme,
} from "@/lib/theme";

interface CommandItem {
  id: string;
  label: string;
  group: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(getAppliedTheme() === "dark");
    return listenThemeChange((theme) => setIsDark(theme === "dark"));
  }, []);

  useEffect(() => {
    if (open) setIsDark(getAppliedTheme() === "dark");
  }, [open]);

  const toggleTheme = useCallback(() => {
    const nextTheme = toggleStoredTheme();
    setIsDark(nextTheme === "dark");
    setOpen(false);
  }, []);

  const items: CommandItem[] = [
    { id: "search", label: "全站搜索", group: "导航", icon: <Search className="h-4 w-4" />, shortcut: "/search", action: () => { router.push("/search"); setOpen(false); } },
    { id: "hot", label: "精选热帖", group: "导航", icon: <Hash className="h-4 w-4" />, shortcut: "/hot", action: () => { router.push("/forum?view=list"); setOpen(false); } },
    { id: "cards", label: "卡片视图", group: "导航", icon: <Hash className="h-4 w-4" />, shortcut: "/cards", action: () => { router.push("/forum?view=card"); setOpen(false); } },
    { id: "tags", label: "标签视图", group: "导航", icon: <Hash className="h-4 w-4" />, shortcut: "/tags", action: () => { router.push("/forum?view=tag"); setOpen(false); } },
    { id: "topics", label: "主题视图", group: "导航", icon: <Hash className="h-4 w-4" />, shortcut: "/topics", action: () => { router.push("/forum?view=topic"); setOpen(false); } },
    { id: "knowledge", label: "知识问答", group: "导航", icon: <Hash className="h-4 w-4" />, shortcut: "/knowledge", action: () => { router.push("/knowledge"); setOpen(false); } },
    { id: "new", label: "发布新帖", group: "动作", icon: <PenSquare className="h-4 w-4" />, shortcut: "/new", action: () => { router.push("/forum/new"); setOpen(false); } },
    { id: "theme", label: isDark ? "切换亮色模式" : "切换暗色模式", group: "动作", icon: isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />, action: toggleTheme },
    { id: "profile", label: "个人设置", group: "动作", icon: <User className="h-4 w-4" />, shortcut: "/profile", action: () => { router.push("/user/profile"); setOpen(false); } },
    { id: "feedback", label: "意见反馈", group: "动作", icon: <MessageSquare className="h-4 w-4" />, shortcut: "/feedback", action: () => { router.push("/feedback"); setOpen(false); } },
    ...(isAdmin
      ? [
          { id: "admin-feedback", label: "反馈管理", group: "管理", icon: <Inbox className="h-4 w-4" />, shortcut: "/admin/feedback", action: () => { router.push("/admin/feedback"); setOpen(false); } },
          { id: "admin-users", label: "用户管理", group: "管理", icon: <Users className="h-4 w-4" />, shortcut: "/admin/users", action: () => { router.push("/admin/users"); setOpen(false); } },
        ]
      : []),
  ];

  const filtered = query
    ? items.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        (item.shortcut && item.shortcut.toLowerCase().includes(query.toLowerCase()))
      )
    : items;

  const groups = Array.from(new Set(filtered.map((i) => i.group)));

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const handleToggle = () => setOpen((prev) => !prev);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("command-palette:toggle", handleToggle);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("command-palette:toggle", handleToggle);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
    }
  };

  if (!open) return null;

  return (
    <div data-command-palette className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={() => setOpen(false)}
      />
      <div className="relative z-10 w-full max-w-lg animate-in zoom-in-95 fade-in duration-150">
        <div className="overflow-hidden border border-border bg-background shadow-2xl">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
              onKeyDown={handleKeyDown}
              placeholder="搜索导航、文章、动作..."
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
              ESC
            </kbd>
          </div>

          <div className="max-h-[320px] overflow-y-auto p-2">
            {groups.map((group) => (
              <div key={group}>
                <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {group}
                </p>
                {filtered
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const globalIdx = filtered.indexOf(item);
                    return (
                      <button
                        key={item.id}
                        onClick={item.action}
                        className={`flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors ${
                          globalIdx === selectedIndex
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        }`}
                      >
                        {item.icon}
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.shortcut && (
                          <span className="text-xs text-muted-foreground/60">{item.shortcut}</span>
                        )}
                      </button>
                    );
                  })}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                没有找到匹配的命令
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground/60">
            <span>↑↓ 选择</span>
            <span>↵ 执行</span>
            <span>esc 关闭</span>
            <span className="ml-auto">⌘K</span>
          </div>
        </div>
      </div>
    </div>
  );
}
