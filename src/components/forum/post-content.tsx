"use client";

import { Fragment, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { PostImageViewer } from "@/components/forum/post-image-viewer";
import { cn } from "@/lib/utils";
import {
  getStoredPostContentFormat,
  normalizePostContentFormat,
  stripPostContentMarker,
} from "@/lib/forum/content-format";

type InlinePart =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string };

type MarkdownBlock =
  | { type: "paragraph"; lines: string[] }
  | { type: "heading"; text: string; level: number }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; lines: string[] }
  | { type: "code"; code: string }
  | { type: "image"; alt: string; src: string };

const MARKDOWN_IMAGE_PATTERN =
  /^!\[([^\]\n]*)\]\((\/forum-images\/[A-Za-z0-9._~/%-]+|\/knowledge-images\/[A-Za-z0-9._~/%-]+)\)$/;
const MARKDOWN_LINK_PATTERN =
  /\[([^\]\n]+)\]\((https?:\/\/[^\s]+|\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+)\)/gi;
const BARE_URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_URL_PUNCTUATION = /[.,;:!?，。；：！？）)\]}]+$/;
const STRONG_PATTERN = /(\*\*|__)([^*_][\s\S]*?)\1/g;
const INLINE_CODE_PATTERN = /`([^`\n]+)`/g;
const HEADING_PATTERN = /^(#{1,4})\s+(.+)$/;
const UNORDERED_LIST_PATTERN = /^\s*[-*]\s+(.+)$/;
const ORDERED_LIST_PATTERN = /^\s*\d+[.)]\s+(.+)$/;
const QUOTE_PATTERN = /^\s*>\s?(.+)$/;

function isSafeHref(href: string) {
  return /^https?:\/\//i.test(href) || (href.startsWith("/") && !href.startsWith("//"));
}

function splitBareUrls(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
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

    parts.push(isSafeHref(href) ? { type: "link", text: href, href } : { type: "text", text: href });

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

function splitInlineCode(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let lastIndex = 0;
  INLINE_CODE_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = INLINE_CODE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    parts.push({ type: "code", text: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", text: text.slice(lastIndex) });
  }

  return parts;
}

function splitStrongText(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let lastIndex = 0;
  STRONG_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = STRONG_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...splitInlineCode(text.slice(lastIndex, match.index)));
    }

    parts.push({ type: "strong", text: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(...splitInlineCode(text.slice(lastIndex)));
  }

  return parts;
}

function parsePlainInlineText(text: string): InlinePart[] {
  const parts: InlinePart[] = [];

  for (const part of splitBareUrls(text)) {
    if (part.type === "text") {
      parts.push(...splitStrongText(part.text));
      continue;
    }

    parts.push(part);
  }

  return parts;
}

function parseInlineLinks(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let lastIndex = 0;
  MARKDOWN_LINK_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = MARKDOWN_LINK_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...parsePlainInlineText(text.slice(lastIndex, match.index)));
    }

    const href = match[2];
    parts.push(
      isSafeHref(href)
        ? { type: "link", text: match[1], href }
        : { type: "text", text: match[0] }
    );
    lastIndex = match.index + match[0].length;
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
  let quoteLines: string[] = [];
  let inCodeBlock = false;
  const codeLines: string[] = [];

  const flushParagraph = () => {
    const lines = paragraphLines.map((line) => line.trimEnd()).filter(Boolean);
    if (lines.length > 0) blocks.push({ type: "paragraph", lines });
    paragraphLines.length = 0;
  };

  const flushList = () => {
    if (listBlock && listBlock.items.length > 0) blocks.push(listBlock);
    listBlock = null;
  };

  const flushQuote = () => {
    if (quoteLines.length > 0) blocks.push({ type: "quote", lines: quoteLines });
    quoteLines = [];
  };

  const flushAllTextBlocks = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        blocks.push({ type: "code", code: codeLines.join("\n") });
        codeLines.length = 0;
        inCodeBlock = false;
      } else {
        flushAllTextBlocks();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      flushAllTextBlocks();
      continue;
    }

    const imageMatch = line.trim().match(MARKDOWN_IMAGE_PATTERN);
    if (imageMatch) {
      flushAllTextBlocks();
      blocks.push({ type: "image", alt: imageMatch[1] || "帖子图片", src: imageMatch[2] });
      continue;
    }

    const headingMatch = line.match(HEADING_PATTERN);
    if (headingMatch) {
      flushAllTextBlocks();
      blocks.push({
        type: "heading",
        level: Math.min(4, headingMatch[1].length),
        text: headingMatch[2].trim(),
      });
      continue;
    }

    const quoteMatch = line.match(QUOTE_PATTERN);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      quoteLines.push(quoteMatch[1]);
      continue;
    }

    const unorderedMatch = line.match(UNORDERED_LIST_PATTERN);
    if (unorderedMatch) {
      flushParagraph();
      flushQuote();
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
      flushQuote();
      if (!listBlock || listBlock.type !== "ol") {
        flushList();
        listBlock = { type: "ol", items: [] };
      }
      listBlock.items.push(orderedMatch[1].trim());
      continue;
    }

    flushList();
    flushQuote();
    paragraphLines.push(line);
  }

  if (inCodeBlock && codeLines.length > 0) {
    blocks.push({ type: "code", code: codeLines.join("\n") });
  }

  flushAllTextBlocks();
  return blocks;
}

function renderInline(text: string) {
  return parseInlineLinks(text).map((part, index) => {
    if (part.type === "strong") {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.text}
        </strong>
      );
    }

    if (part.type === "code") {
      return (
        <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
          {part.text}
        </code>
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
        >
          <span>{part.text}</span>
          {external && <ExternalLink className="inline h-3 w-3 shrink-0" aria-hidden="true" />}
        </a>
      );
    }

    return <span key={index}>{part.text}</span>;
  });
}

function renderLines(lines: string[]) {
  return lines.map((line, index) => (
    <Fragment key={index}>
      {index > 0 && <br />}
      {renderInline(line)}
    </Fragment>
  ));
}

function PostImage({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="space-y-2">
      <PostImageViewer src={src} alt={alt} />
      {alt && <figcaption className="text-xs text-muted-foreground">{alt}</figcaption>}
    </figure>
  );
}

function PlainPostContent({ content, images }: { content: string; images: string[] }) {
  return (
    <div className="space-y-4">
      <div className="space-y-3 leading-7">
        {content.split(/\r?\n/).map((paragraph, index) => (
          <p key={index} className="whitespace-pre-wrap">
            {paragraph}
          </p>
        ))}
      </div>
      {images.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {images.map((src, index) => (
            <PostImage key={`${src}-${index}`} src={src} alt={`帖子图片 ${index + 1}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function MarkdownPostContent({ content, images }: { content: string; images: string[] }) {
  const blocks = parseMarkdownBlocks(content);
  const referencedImages = new Set(
    blocks.filter((block): block is Extract<MarkdownBlock, { type: "image" }> => block.type === "image").map((block) => block.src)
  );
  const unattachedImages = images.filter((src) => !referencedImages.has(src));

  return (
    <div className="space-y-4 leading-7">
      {blocks.map((block, index): ReactNode => {
        if (block.type === "heading") {
          const Tag = block.level <= 1 ? "h2" : block.level === 2 ? "h3" : "h4";
          return (
            <Tag
              key={index}
              className={cn(
                "font-semibold tracking-normal text-foreground",
                block.level <= 1 ? "text-2xl" : block.level === 2 ? "text-xl" : "text-lg"
              )}
            >
              {renderInline(block.text)}
            </Tag>
          );
        }

        if (block.type === "ul") {
          return (
            <ul key={index} className="ml-5 list-disc space-y-1">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "ol") {
          return (
            <ol key={index} className="ml-5 list-decimal space-y-1">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === "quote") {
          return (
            <blockquote key={index} className="border-l-4 border-border pl-4 text-muted-foreground">
              {renderLines(block.lines)}
            </blockquote>
          );
        }

        if (block.type === "code") {
          return (
            <pre key={index} className="overflow-x-auto rounded-md bg-muted p-4 text-sm leading-6">
              <code>{block.code}</code>
            </pre>
          );
        }

        if (block.type === "image") {
          return <PostImage key={`${block.src}-${index}`} src={block.src} alt={block.alt} />;
        }

        return <p key={index}>{renderLines(block.lines)}</p>;
      })}
      {unattachedImages.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {unattachedImages.map((src, index) => (
            <PostImage key={`${src}-${index}`} src={src} alt={`帖子图片 ${index + 1}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PostContent({
  content,
  format,
  images = [],
  className,
}: {
  content: string;
  format?: string | null;
  images?: string[] | null;
  className?: string;
}) {
  const cleanContent = stripPostContentMarker(content);
  const normalizedFormat = format
    ? normalizePostContentFormat(format)
    : getStoredPostContentFormat(content);
  const safeImages = (images ?? []).filter((src) => src.startsWith("/forum-images/"));

  return (
    <div className={cn("break-words text-sm md:text-base", className)}>
      {normalizedFormat === "markdown" ? (
        <MarkdownPostContent content={cleanContent} images={safeImages} />
      ) : (
        <PlainPostContent content={cleanContent} images={safeImages} />
      )}
    </div>
  );
}
