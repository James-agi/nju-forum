"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, LayoutGrid, List, Tag, Boxes } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const VIEWS = [
  { key: "list", label: "列表", icon: List },
  { key: "card", label: "卡片", icon: LayoutGrid },
  { key: "tag", label: "标签", icon: Tag },
  { key: "topic", label: "主题", icon: Boxes },
] as const;

export function ViewSwitcher({ current }: { current: string }) {
  const router = useRouter();
  const active = VIEWS.find((v) => v.key === current) ?? VIEWS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 border border-border px-4 text-sm text-foreground transition-colors hover:border-foreground/40 hover:bg-muted/30"
        >
          <active.icon className="h-3.5 w-3.5" />
          {active.label}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 rounded-none">
        {VIEWS.map((v) => (
          <DropdownMenuItem
            key={v.key}
            onSelect={() => router.push(`/forum?view=${v.key}`)}
            className={`gap-2 rounded-none ${
              v.key === current ? "bg-accent text-accent-foreground" : ""
            }`}
          >
            <v.icon className="h-3.5 w-3.5" />
            {v.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
