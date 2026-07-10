"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import {
  getAppliedTheme,
  listenThemeChange,
  toggleStoredTheme,
} from "@/lib/theme";
import type { Theme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(getAppliedTheme());
    return listenThemeChange((nextTheme: Theme) => setTheme(nextTheme));
  }, []);

  const toggle = () => {
    setTheme(toggleStoredTheme());
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="切换色调"
      title={theme === "dark" ? "切换到浅色" : "切换到深色"}
      className="inline-flex h-8 w-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
    >
      {!mounted ? (
        <span className="h-4 w-4" />
      ) : theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
