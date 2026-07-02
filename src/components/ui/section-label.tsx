import { cn } from "@/lib/utils";

interface SectionLabelProps {
  en: string;
  zh?: string;
  className?: string;
}

export function SectionLabel({ en, zh, className }: SectionLabelProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="section-label">{en}</p>
      {zh && <h1 className="section-title">{zh}</h1>}
    </div>
  );
}
