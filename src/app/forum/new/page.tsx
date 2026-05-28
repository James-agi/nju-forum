"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PenSquare } from "lucide-react";

interface Section {
  id: string;
  name: string;
  icon: string | null;
}

export default function NewPostPage() {
  const router = useRouter();
  const { status } = useSession();
  const [sections, setSections] = useState<Section[]>([]);
  const [form, setForm] = useState({
    title: "",
    content: "",
    sectionId: "",
    tags: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    fetch("/api/sections")
      .then((res) => res.json())
      .then((data) => setSections(data));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.title.trim() || !form.content.trim() || !form.sectionId) {
      setError("请填写所有必填字段");
      return;
    }

    setLoading(true);

    try {
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tags }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "发帖失败");
      } else {
        const data = await res.json();
        router.push(`/forum/post/${data.id}`);
      }
    } catch {
      setError("发帖失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">加载中...</div>;
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenSquare className="h-5 w-5" />
            发帖
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label>分区</Label>
              <Select
                value={form.sectionId}
                onValueChange={(value) => setForm({ ...form, sectionId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择分区" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.icon} {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">标题</Label>
              <Input
                id="title"
                placeholder="帖子标题（最多100字）"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">内容</Label>
              <Textarea
                id="content"
                placeholder="写下你想说的..."
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={10}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">标签（可选，逗号分隔）</Label>
              <Input
                id="tags"
                placeholder="例如：求助, 急, 置顶"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "发布中..." : "发布帖子"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
