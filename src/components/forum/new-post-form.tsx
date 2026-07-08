"use client";

import { type ChangeEvent, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Code2, FileText, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PostContent } from "@/components/forum/post-content";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
}

type ContentFormat = "plain" | "markdown";

interface UploadedImage {
  url: string;
  alt: string;
}

const MAX_IMAGES = 6;

function buildMarkdownImages(images: UploadedImage[]) {
  return images.map((image) => `![${image.alt}](${image.url})`).join("\n");
}

function appendMarkdownImages(content: string, images: UploadedImage[]) {
  if (images.length === 0) return content;

  const markdown = buildMarkdownImages(images.filter((image) => !content.includes(image.url)));

  if (!markdown) return content;
  return content.trimEnd() ? `${content.trimEnd()}\n\n${markdown}` : markdown;
}

function removeMarkdownImage(content: string, imageUrl: string) {
  return content
    .split(/\r?\n/)
    .filter((line) => !line.includes(`](${imageUrl})`))
    .join("\n");
}

export function NewPostForm({
  sections,
  existingTags = [],
}: {
  sections: Section[];
  existingTags?: string[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const contentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    sectionId: "",
    contentFormat: "plain" as ContentFormat,
  });
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  const toggleTag = (name: string) => {
    setSelectedTags((prev) =>
      prev.includes(name) ? prev.filter((tag) => tag !== name) : [...prev, name]
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

  const updateContentFormat = (contentFormat: ContentFormat) => {
    setForm((prev) => ({
      ...prev,
      contentFormat,
      content:
        contentFormat === "markdown"
          ? appendMarkdownImages(prev.content, images)
          : images.reduce(
              (currentContent, image) => removeMarkdownImage(currentContent, image.url),
              prev.content
            ),
    }));
  };

  const insertMarkdownAtCursor = (markdown: string) => {
    const textarea = contentInputRef.current;

    setForm((prev) => {
      if (!textarea) {
        return {
          ...prev,
          content: prev.content.trimEnd() ? `${prev.content.trimEnd()}\n\n${markdown}` : markdown,
        };
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = prev.content.slice(0, start);
      const after = prev.content.slice(end);
      const prefix = before && !before.endsWith("\n") ? "\n\n" : "";
      const suffix = after && !after.startsWith("\n") ? "\n\n" : "";
      const nextContent = `${before}${prefix}${markdown}${suffix}${after}`;
      const nextCursor = start + prefix.length + markdown.length;

      window.requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(nextCursor, nextCursor);
      });

      return { ...prev, content: nextContent };
    });
  };

  const uploadImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setError("");

    if (images.length + files.length > MAX_IMAGES) {
      setError(`一篇帖子最多添加 ${MAX_IMAGES} 张图片`);
      event.target.value = "";
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));
    setUploadingImages(true);

    try {
      const res = await fetch("/api/forum/images", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "图片上传失败");
        return;
      }

      const uploadedImages = (data.images ?? []) as UploadedImage[];
      setImages((prev) => [...prev, ...uploadedImages]);
      if (form.contentFormat === "markdown") {
        insertMarkdownAtCursor(buildMarkdownImages(uploadedImages));
      }
    } catch {
      setError("图片上传失败，请稍后再试");
    } finally {
      setUploadingImages(false);
      event.target.value = "";
    }
  };

  const removeImage = (imageUrl: string) => {
    setImages((prev) => prev.filter((image) => image.url !== imageUrl));
    setForm((prev) => ({
      ...prev,
      content:
        prev.contentFormat === "markdown"
          ? removeMarkdownImage(prev.content, imageUrl)
          : prev.content,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.title.trim() || !form.sectionId || (!form.content.trim() && images.length === 0)) {
      setError("请填写标题、分区，并输入内容或添加图片");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          content: form.content,
          tags: selectedTags,
          images: form.contentFormat === "plain" ? images.map((image) => image.url) : [],
        }),
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

  const canSubmit =
    !loading &&
    !uploadingImages &&
    Boolean(form.title.trim()) &&
    Boolean(form.sectionId) &&
    (Boolean(form.content.trim()) || images.length > 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
          placeholder="帖子标题，最多 100 字"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          maxLength={100}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>编辑模式</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={form.contentFormat === "plain" ? "default" : "outline"}
            onClick={() => updateContentFormat("plain")}
            className="justify-start"
          >
            <FileText className="mr-2 h-4 w-4" />
            普通文本
          </Button>
          <Button
            type="button"
            variant={form.contentFormat === "markdown" ? "default" : "outline"}
            onClick={() => updateContentFormat("markdown")}
            className="justify-start"
          >
            <Code2 className="mr-2 h-4 w-4" />
            Markdown
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="content">内容</Label>
          {form.contentFormat === "markdown" && (
            <span className="text-xs text-muted-foreground">实时预览</span>
          )}
        </div>
        <div
          className={cn(
            form.contentFormat === "markdown" && "grid gap-3 lg:grid-cols-2"
          )}
        >
          <Textarea
            ref={contentInputRef}
            id="content"
            placeholder={
              form.contentFormat === "markdown"
                ? "支持 # 标题、列表、**加粗**、链接、代码块和图片 Markdown"
                : "写下你想说的..."
            }
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={form.contentFormat === "markdown" ? 18 : 12}
            className={cn(form.contentFormat === "markdown" && "min-h-[420px]")}
          />
          {form.contentFormat === "markdown" && (
            <div className="min-h-[420px] overflow-hidden rounded-md border bg-background">
              <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                预览
              </div>
              <div className="max-h-[560px] overflow-auto p-4">
                {form.content.trim() ? (
                  <PostContent
                    content={form.content}
                    format="markdown"
                    images={[]}
                    className="text-sm"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">预览为空</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label>图片</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImages || images.length >= MAX_IMAGES}
          >
            {uploadingImages ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="mr-2 h-4 w-4" />
            )}
            添加图片
          </Button>
        </div>
        <Input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          multiple
          className="hidden"
          onChange={uploadImages}
        />

        {images.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {images.map((image, index) => (
              <div key={image.url} className="relative h-40 overflow-hidden rounded-md border bg-muted/30">
                <Image
                  src={image.url}
                  alt={image.alt || `帖子图片 ${index + 1}`}
                  fill
                  sizes="(min-width: 640px) 50vw, 100vw"
                  className="object-contain"
                  unoptimized
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-2 h-7 w-7"
                  onClick={() => removeImage(image.url)}
                  aria-label="移除图片"
                  title="移除图片"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
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
                <X className="h-3 w-3" aria-hidden="true" />
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

        {existingTags.filter((tag) => !selectedTags.includes(tag)).length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-xs text-muted-foreground">点击选择已有标签</p>
            <div className="flex flex-wrap gap-2">
              {existingTags
                .filter((tag) => !selectedTags.includes(tag))
                .map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "inline-flex items-center border border-border px-2.5 py-1",
                      "text-xs text-muted-foreground transition-colors",
                      "hover:border-foreground/40 hover:text-foreground"
                    )}
                  >
                    {tag}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={!canSubmit}>
        {loading ? "发布中..." : "发布帖子"}
      </Button>
    </form>
  );
}
