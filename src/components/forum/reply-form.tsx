"use client";

import Link from "next/link";
import { type ChangeEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Code2, FileText, ImagePlus, Loader2, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PostContent } from "@/components/forum/post-content";
import { cn } from "@/lib/utils";

interface ReplyFormProps {
  postId: string;
  parentId?: string;
  onCancel?: () => void;
  placeholder?: string;
  canReply?: boolean;
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

function removeMarkdownImage(content: string, imageUrl: string) {
  return content
    .split(/\r?\n/)
    .filter((line) => !line.includes(`](${imageUrl})`))
    .join("\n");
}

export function ReplyForm({
  postId,
  parentId,
  onCancel,
  placeholder,
  canReply = true,
}: ReplyFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const contentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [content, setContent] = useState("");
  const [contentFormat, setContentFormat] = useState<ContentFormat>("plain");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [error, setError] = useState("");

  const updateContentFormat = (nextFormat: ContentFormat) => {
    setContentFormat(nextFormat);
    setContent((current) => {
      if (nextFormat === "plain") {
        return images.reduce(
          (currentContent, image) => removeMarkdownImage(currentContent, image.url),
          current
        );
      }

      const missingImages = images.filter((image) => !current.includes(image.url));
      if (missingImages.length === 0) return current;
      const markdown = buildMarkdownImages(missingImages);
      return current.trimEnd() ? `${current.trimEnd()}\n\n${markdown}` : markdown;
    });
  };

  const insertMarkdownAtCursor = (markdown: string) => {
    const textarea = contentInputRef.current;

    setContent((current) => {
      if (!textarea) {
        return current.trimEnd() ? `${current.trimEnd()}\n\n${markdown}` : markdown;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = current.slice(0, start);
      const after = current.slice(end);
      const prefix = before && !before.endsWith("\n") ? "\n\n" : "";
      const suffix = after && !after.startsWith("\n") ? "\n\n" : "";
      const nextContent = `${before}${prefix}${markdown}${suffix}${after}`;
      const nextCursor = start + prefix.length + markdown.length;

      window.requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(nextCursor, nextCursor);
      });

      return nextContent;
    });
  };

  const uploadImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setError("");

    if (images.length + files.length > MAX_IMAGES) {
      setError(`一条回复最多添加 ${MAX_IMAGES} 张图片`);
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
      if (contentFormat === "markdown") {
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
    setContent((current) => removeMarkdownImage(current, imageUrl));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!content.trim() && images.length === 0) || !canReply) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/posts/${postId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          contentFormat,
          parentId,
          images: contentFormat === "plain" ? images.map((image) => image.url) : [],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "回复失败");
      } else {
        setContent("");
        setImages([]);
        setContentFormat("plain");
        onCancel?.();
        router.refresh();
      }
    } catch {
      setError("回复失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  };

  if (!canReply) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        登录后参与讨论。<Link href="/login" className="ml-1 text-primary hover:underline">立即登录</Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={contentFormat === "plain" ? "default" : "outline"}
          size="sm"
          onClick={() => updateContentFormat("plain")}
          className="justify-start"
        >
          <FileText className="mr-2 h-4 w-4" />
          普通文本
        </Button>
        <Button
          type="button"
          variant={contentFormat === "markdown" ? "default" : "outline"}
          size="sm"
          onClick={() => updateContentFormat("markdown")}
          className="justify-start"
        >
          <Code2 className="mr-2 h-4 w-4" />
          Markdown
        </Button>
      </div>

      <div className={cn(contentFormat === "markdown" && !parentId && "grid gap-3 lg:grid-cols-2")}>
        <Textarea
          ref={contentInputRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            contentFormat === "markdown"
              ? "支持 # 标题、列表、**加粗**、链接、代码块和图片 Markdown"
              : placeholder || "写下你的回复..."
          }
          rows={contentFormat === "markdown" && !parentId ? 8 : parentId ? 3 : 4}
          className={cn(contentFormat === "markdown" && !parentId && "min-h-[220px]")}
        />
        {contentFormat === "markdown" && !parentId && (
          <div className="min-h-[220px] overflow-hidden rounded-md border bg-background">
            <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
              预览
            </div>
            <div className="max-h-[320px] overflow-auto p-3">
              {content.trim() ? (
                <PostContent content={content} format="markdown" images={[]} className="text-sm" />
              ) : (
                <p className="text-sm text-muted-foreground">预览为空</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {contentFormat === "markdown" ? "图片会插入到当前光标位置" : "图片会显示在回复正文下方"}
          </span>
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
          <div className="grid gap-2 sm:grid-cols-2">
            {images.map((image, index) => (
              <div key={image.url} className="relative overflow-hidden rounded-md border bg-muted/30">
                <img
                  src={image.url}
                  alt={image.alt || `回复图片 ${index + 1}`}
                  className="h-28 w-full object-contain"
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

      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={loading || uploadingImages || (!content.trim() && images.length === 0)}
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          {loading ? "发送中..." : "回复"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            取消
          </Button>
        )}
      </div>
    </form>
  );
}
