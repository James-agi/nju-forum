"use client";

import { Fragment, useState, type PointerEvent, type ReactNode, type WheelEvent } from "react";
import { ExternalLink, Maximize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface SourceExcerptBlockProps {
  sourceExcerpt: string;
}

type SourceExcerptPart =
  | { type: "text"; text: string }
  | { type: "image"; alt: string; src: string };

type InlineTextPart =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "link"; text: string; href: string };

type MarkdownBlock =
  | { type: "paragraph"; lines: string[] }
  | { type: "heading"; text: string; level: number }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

const LOCAL_IMAGE_MARKDOWN =
  /^!\[([^\]\n]*)\]\((\/knowledge-images\/[A-Za-z0-9._~/%-]+)\)$/;
const MARKDOWN_LINK_PATTERN =
  /\[([^\]\n]+)\]\((https?:\/\/[^\s]+|\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+)\)/gi;
const BARE_URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_URL_PUNCTUATION = /[.,;:!?，。；：！？）)\]}]+$/;
const STRONG_PATTERN = /(\*\*|__)([^*_][\s\S]*?)\1/g;
const HEADING_PATTERN = /^(#{1,4})\s+(.+)$/;
const UNORDERED_LIST_PATTERN = /^\s*[-*]\s+(.+)$/;
const ORDERED_LIST_PATTERN = /^\s*\d+[.)]\s+(.+)$/;
const MIN_IMAGE_ZOOM = 0.5;
const MAX_IMAGE_ZOOM = 4;
const IMAGE_ZOOM_STEP = 0.2;

interface Point {
  x: number;
  y: number;
}

interface DragStart extends Point {
  pointerId: number;
  panX: number;
  panY: number;
}

function clampImageZoom(value: number) {
  return Math.min(MAX_IMAGE_ZOOM, Math.max(MIN_IMAGE_ZOOM, value));
}

function isSafeHref(href: string) {
  return /^https?:\/\//i.test(href) || (href.startsWith("/") && !href.startsWith("//"));
}

function splitBareUrls(text: string): InlineTextPart[] {
  const parts: InlineTextPart[] = [];
  let lastIndex = 0;
  BARE_URL_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = BARE_URL_PATTERN.exec(text)) !== null) {
    const matchedText = match[0];
    const index = match.index;
    let href = matchedText;
    let trailingText = "";

    while (TRAILING_URL_PUNCTUATION.test(href)) {
      trailingText = href.slice(-1) + trailingText;
      href = href.slice(0, -1);
    }

    if (index > lastIndex) {
      parts.push({ type: "text", text: text.slice(lastIndex, index) });
    }

    if (isSafeHref(href)) {
      parts.push({ type: "link", text: href, href });
    } else {
      parts.push({ type: "text", text: href });
    }

    if (trailingText) {
      parts.push({ type: "text", text: trailingText });
    }

    lastIndex = index + matchedText.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", text: text.slice(lastIndex) });
  }

  return parts;
}

function splitStrongText(text: string): InlineTextPart[] {
  const parts: InlineTextPart[] = [];
  let lastIndex = 0;
  STRONG_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = STRONG_PATTERN.exec(text)) !== null) {
    const index = match.index;
    if (index > lastIndex) {
      parts.push({ type: "text", text: text.slice(lastIndex, index) });
    }

    parts.push({ type: "strong", text: match[2] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", text: text.slice(lastIndex) });
  }

  return parts;
}

function parsePlainInlineText(text: string): InlineTextPart[] {
  const parts: InlineTextPart[] = [];

  for (const part of splitBareUrls(text)) {
    if (part.type === "text") {
      parts.push(...splitStrongText(part.text));
      continue;
    }

    parts.push(part);
  }

  return parts;
}

function parseInlineLinks(text: string): InlineTextPart[] {
  const parts: InlineTextPart[] = [];
  let lastIndex = 0;
  MARKDOWN_LINK_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = MARKDOWN_LINK_PATTERN.exec(text)) !== null) {
    const matchedText = match[0];
    const label = match[1];
    const href = match[2];
    const index = match.index;

    if (index > lastIndex) {
      parts.push(...parsePlainInlineText(text.slice(lastIndex, index)));
    }

    if (isSafeHref(href)) {
      parts.push({ type: "link", text: label, href });
    } else {
      parts.push({ type: "text", text: matchedText });
    }

    lastIndex = index + matchedText.length;
  }

  if (lastIndex < text.length) {
    parts.push(...parsePlainInlineText(text.slice(lastIndex)));
  }

  return parts.length > 0 ? parts : [{ type: "text", text }];
}

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const paragraphLines: string[] = [];
  let listBlock: Extract<MarkdownBlock, { type: "ul" | "ol" }> | null = null;

  const flushParagraph = () => {
    const lines = paragraphLines.map((line) => line.trimEnd()).filter(Boolean);
    if (lines.length > 0) blocks.push({ type: "paragraph", lines });
    paragraphLines.length = 0;
  };

  const flushList = () => {
    if (listBlock && listBlock.items.length > 0) {
      blocks.push(listBlock);
    }
    listBlock = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(HEADING_PATTERN);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: Math.min(4, headingMatch[1].length),
        text: headingMatch[2].trim(),
      });
      continue;
    }

    const unorderedMatch = line.match(UNORDERED_LIST_PATTERN);
    if (unorderedMatch) {
      flushParagraph();
      if (!listBlock || listBlock.type !== "ul") {
        flushList();
        listBlock = { type: "ul", items: [] };
      }
      listBlock.items.push(unorderedMatch[1].trim());
      continue;
    }

    const orderedMatch = line.match(ORDERED_LIST_PATTERN);
    if (orderedMatch) {
      flushParagraph();
      if (!listBlock || listBlock.type !== "ol") {
        flushList();
        listBlock = { type: "ol", items: [] };
      }
      listBlock.items.push(orderedMatch[1].trim());
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function parseSourceExcerpt(sourceExcerpt: string): SourceExcerptPart[] {
  const parts: SourceExcerptPart[] = [];
  const textBuffer: string[] = [];

  const flushText = () => {
    const text = textBuffer.join("\n").trim();
    if (text) parts.push({ type: "text", text });
    textBuffer.length = 0;
  };

  for (const line of sourceExcerpt.split(/\r?\n/)) {
    const imageMatch = line.trim().match(LOCAL_IMAGE_MARKDOWN);
    if (!imageMatch) {
      textBuffer.push(line);
      continue;
    }

    flushText();
    parts.push({
      type: "image",
      alt: imageMatch[1] || "原文图片",
      src: imageMatch[2],
    });
  }

  flushText();
  return parts;
}

export function LinkifiedText({ text }: { text: string }) {
  const parts = parseInlineLinks(text);

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === "strong") {
          return (
            <strong key={index} className="font-semibold text-foreground">
              {part.text}
            </strong>
          );
        }

        if (part.type === "link") {
          const external = /^https?:\/\//i.test(part.href);

          return (
            <a
              key={`${part.href}-${index}`}
              href={part.href}
              target={external ? "_blank" : undefined}
              rel={external ? "noreferrer" : undefined}
              className="inline-flex max-w-full items-baseline gap-1 break-all text-primary underline underline-offset-2 hover:text-primary/80"
              onClick={(event) => event.stopPropagation()}
            >
              <span>{part.text}</span>
              {external && <ExternalLink className="inline h-3 w-3 shrink-0" aria-hidden="true" />}
            </a>
          );
        }

        return <span key={index}>{part.text}</span>;
      })}
    </>
  );
}

function renderParagraphLines(lines: string[]) {
  return lines.map((line, index) => (
    <Fragment key={index}>
      {index > 0 && <br />}
      <LinkifiedText text={line} />
    </Fragment>
  ));
}

export function MarkdownText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const blocks = parseMarkdownBlocks(text);

  if (blocks.length === 0) return null;

  return (
    <div className={cn("space-y-2 break-words", className)}>
      {blocks.map((block, index): ReactNode => {
        if (block.type === "heading") {
          return (
            <p
              key={index}
              className={cn(
                "font-semibold text-foreground",
                block.level <= 2 ? "text-base" : "text-sm"
              )}
            >
              <LinkifiedText text={block.text} />
            </p>
          );
        }

        if (block.type === "ul") {
          return (
            <ul key={index} className="ml-5 list-disc space-y-1">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <LinkifiedText text={item} />
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "ol") {
          return (
            <ol key={index} className="ml-5 list-decimal space-y-1">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <LinkifiedText text={item} />
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={index}>
            {renderParagraphLines(block.lines)}
          </p>
        );
      })}
    </div>
  );
}

function SourceImageFigure({ alt, src }: { alt: string; src: string }) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<DragStart | null>(null);

  const updateOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setDragStart(null);
    }
  };

  const updateZoom = (nextZoom: number) => {
    const clampedZoom = clampImageZoom(nextZoom);
    setZoom(clampedZoom);
    if (clampedZoom <= 1) {
      setPan({ x: 0, y: 0 });
      setDragStart(null);
    }
  };

  const zoomIn = () => updateZoom(zoom + IMAGE_ZOOM_STEP);
  const zoomOut = () => updateZoom(zoom - IMAGE_ZOOM_STEP);
  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDragStart(null);
  };

  const handleWheelZoom = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    updateZoom(
      zoom + (event.deltaY < 0 ? IMAGE_ZOOM_STEP : -IMAGE_ZOOM_STEP)
    );
  };

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragStart({
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    });
  };

  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart || event.pointerId !== dragStart.pointerId) return;

    event.preventDefault();
    setPan({
      x: dragStart.panX + event.clientX - dragStart.x,
      y: dragStart.panY + event.clientY - dragStart.y,
    });
  };

  const stopPan = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart || event.pointerId !== dragStart.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragStart(null);
  };

  return (
    <figure className="space-y-1">
      <Dialog open={open} onOpenChange={updateOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="group relative block w-full cursor-zoom-in overflow-hidden rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label={`放大查看${alt ? `：${alt}` : "原文图片"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={src}
              alt={alt}
              className="max-h-96 w-full object-contain transition group-hover:opacity-90"
              loading="lazy"
            />
            <span className="absolute bottom-2 right-2 rounded-md bg-background/90 p-1 text-muted-foreground shadow-sm">
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            </span>
          </button>
        </DialogTrigger>
        <DialogContent className="max-h-[92vh] max-w-[92vw] overflow-hidden p-3">
          <DialogTitle className="sr-only">原文图片预览</DialogTitle>
          <DialogDescription className="sr-only">
            {alt || "放大的原文图片"}
          </DialogDescription>
          <div className="absolute left-3 top-3 z-10 flex gap-1 rounded-md bg-background/90 p-1 shadow-sm">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={zoomOut}
              disabled={zoom <= MIN_IMAGE_ZOOM}
              aria-label="缩小图片"
              title="缩小图片"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={resetZoom}
              disabled={zoom === 1}
              aria-label="重置图片缩放"
              title="重置图片缩放"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={zoomIn}
              disabled={zoom >= MAX_IMAGE_ZOOM}
              aria-label="放大图片"
              title="放大图片"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          <div
            className="flex max-h-[82vh] min-h-[50vh] items-center justify-center overflow-hidden rounded-md bg-muted/30"
            onWheel={handleWheelZoom}
            onPointerDown={startPan}
            onPointerMove={movePan}
            onPointerUp={stopPan}
            onPointerCancel={stopPan}
            style={{ cursor: zoom > 1 ? (dragStart ? "grabbing" : "grab") : "default" }}
          >
            <img
              src={src}
              alt={alt}
              className="max-h-[82vh] w-full select-none rounded-md object-contain transition-transform"
              draggable={false}
              style={{
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                transformOrigin: "center",
              }}
            />
          </div>
          {alt && <p className="text-sm text-muted-foreground">{alt}</p>}
        </DialogContent>
      </Dialog>
      {alt && (
        <figcaption className="text-xs text-muted-foreground">
          {alt}
        </figcaption>
      )}
    </figure>
  );
}

export function SourceExcerptBlock({ sourceExcerpt }: SourceExcerptBlockProps) {
  const parts = parseSourceExcerpt(sourceExcerpt);

  return (
    <div className="rounded-md bg-muted/50 p-3" onClick={(event) => event.stopPropagation()}>
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        来源原文摘录
      </p>
      <div className="space-y-3">
        {parts.map((part, index) => {
          if (part.type === "image") {
            return (
              <SourceImageFigure
                key={`${part.src}-${index}`}
                src={part.src}
                alt={part.alt}
              />
            );
          }

          return (
            <div
              key={index}
              className="text-sm leading-6 text-muted-foreground"
            >
              <MarkdownText text={part.text} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
