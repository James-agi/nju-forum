"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Section {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
}

export function NewPostForm({
  sections,
  existingTags = [],
}: {
  sections: Section[];
  existingTags?: string[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    content: "",
    sectionId: "",
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleTag = (name: string) => {
    setSelectedTags((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
    );
  };

  const addCustomTag = () => {
    const name = tagInput.trim();
    if (!name) return;
    if (!selectedTags.includes(name)) {
      setSelectedTags((prev) => [...prev, name]);
    }
    setTagInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.title.trim() || !form.content.trim() || !form.sectionId) {
      setError("请填写所有必填字段");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tags: selectedTags }),
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}
      <div className="space-y-2">
        <Label>分区</Label>
        <Select value={form.sectionId} onValueChange={(value) => setForm({ ...form, sectionId: value })}>
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
        <Label>标签（可选）</Label>

        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className="inline-flex items-center gap-1 border border-foreground bg-foreground px-2.5 py-1 text-xs text-background"
              >
                {tag}
                <span className="text-sm leading-none">×</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="自定义标签，回车添加"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomTag();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={addCustomTag}
            disabled={!tagInput.trim()}
          >
            添加
          </Button>
        </div>

        {existingTags.filter((t) => !selectedTags.includes(t)).length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-xs text-muted-foreground">点击选择已有标签</p>
            <div className="flex flex-wrap gap-2">
              {existingTags
                .filter((t) => !selectedTags.includes(t))
                .map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className="inline-flex items-center border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                  >
                    {tag}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "发布中..." : "发布帖子"}
      </Button>
    </form>
  );
}
