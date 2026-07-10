import { Eye, Heart, MessageSquare } from "lucide-react";

/**
 * 帖子统计簇：回复 / 收藏 / 日期，可选浏览数。
 * views 传了才渲染 👁——论坛首页列表不传（不显示浏览数），版块页传 viewCount。
 * className 控制显隐与布局：窄屏 "flex md:hidden" 折进 meta 行，宽屏 "hidden md:flex" 作右侧对齐列。
 */
export function PostStats({
  views,
  replies,
  favorites,
  createdAt,
  className,
}: {
  views?: number;
  replies: number;
  favorites: number;
  createdAt: Date;
  className?: string;
}) {
  return (
    <div
      className={`items-center gap-3 text-xs tabular-nums text-muted-foreground/70 ${className ?? ""}`}
    >
      {views !== undefined && (
        <span className="inline-flex items-center gap-1">
          <Eye className="h-3 w-3" />
          {views}
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <MessageSquare className="h-3 w-3" />
        {replies}
      </span>
      <span className="inline-flex items-center gap-1">
        <Heart className="h-3 w-3" />
        {favorites}
      </span>
      <time className="text-muted-foreground/60">
        {new Date(createdAt).toLocaleDateString("zh-CN")}
      </time>
    </div>
  );
}
