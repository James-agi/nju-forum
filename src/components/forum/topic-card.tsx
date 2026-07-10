import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface TopicCardProps {
  topic: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    count: number;
  };
}

export function TopicCard({ topic }: TopicCardProps) {
  return (
    <Link
      href={`/forum?view=topic&topic=${topic.id}`}
      className="frame-card glow-hover group relative flex h-full min-h-[15rem] flex-col justify-between overflow-hidden border border-border p-6 transition-colors hover:bg-muted/20"
    >
      <div className="pointer-events-none absolute -right-2 -top-6 select-none text-[7rem] font-bold leading-none tracking-tighter text-foreground/[0.06] transition-colors group-hover:text-foreground/[0.1]">
        {topic.count}
      </div>

      <div className="relative">
        <span className="text-3xl">{topic.icon || "📌"}</span>
      </div>

      <div className="relative">
        <h3 className="text-2xl font-bold tracking-tight text-foreground">
          {topic.name}
        </h3>
        {topic.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {topic.description}
          </p>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs tabular-nums text-muted-foreground">
            {topic.count} 个帖子
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
            进入
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
