"use client";

import { useState } from "react";
import Link from "next/link";

interface TagCloudProps {
  tags: Array<{ id: string; name: string; count: number }>;
  total: number;
  activeTag?: string;
  collapsedCount?: number;
}

export function TagCloud({
  tags,
  total,
  activeTag,
  collapsedCount = 9,
}: TagCloudProps) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = tags.length > collapsedCount;
  const visible = expanded ? tags : tags.slice(0, collapsedCount);
  const hiddenCount = tags.length - collapsedCount;

  const chip =
    "inline-flex items-center gap-2 border px-3 py-1.5 text-sm transition-colors";

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/forum?view=tag"
        className={`${chip} ${
          !activeTag
            ? "border-foreground bg-foreground text-background"
            : "border-border text-foreground hover:border-foreground/40"
        }`}
      >
        全部
        <span className="tabular-nums text-xs opacity-70">{total}</span>
      </Link>

      {visible.map((tag) => {
        const isActive = activeTag === tag.name;
        return (
          <Link
            key={tag.id}
            href={`/forum?view=tag&tag=${encodeURIComponent(tag.name)}`}
            className={`${chip} ${
              isActive
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            }`}
          >
            {tag.name}
            <span className="tabular-nums text-xs opacity-70">{tag.count}</span>
          </Link>
        );
      })}

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`${chip} border-dashed border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground`}
        >
          {expanded ? "收起" : `更多 +${hiddenCount}`}
        </button>
      )}
    </div>
  );
}
