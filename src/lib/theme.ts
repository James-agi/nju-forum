export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "theme";
const THEME_CHANGE_EVENT = "nju-theme-change";

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

export function getAppliedTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;

  try {
    const theme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(theme) ? theme : null;
  } catch {
    return null;
  }
}

export function applyTheme(
  theme: Theme,
  options: { persist?: boolean; transition?: boolean; notify?: boolean } = {}
) {
  if (typeof document === "undefined") return;

  const { persist = false, transition = false, notify = true } = options;
  const root = document.documentElement;

  if (transition) {
    root.classList.add("theme-transition");
  }

  root.classList.toggle("dark", theme === "dark");

  if (transition) {
    window.setTimeout(() => root.classList.remove("theme-transition"), 350);
  }

  if (persist && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }

  if (notify && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } })
    );
  }
}

export function toggleStoredTheme(): Theme {
  const nextTheme: Theme = getAppliedTheme() === "dark" ? "light" : "dark";
  applyTheme(nextTheme, { persist: true, transition: true });
  return nextTheme;
}

export function listenThemeChange(listener: (theme: Theme) => void) {
  if (typeof window === "undefined") return () => {};

  const handleThemeChange = (event: Event) => {
    const theme = (event as CustomEvent<{ theme?: Theme }>).detail?.theme;
    listener(theme ?? getAppliedTheme());
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    if (!isTheme(event.newValue)) return;
    applyTheme(event.newValue, { notify: false });
    listener(event.newValue);
  };

  window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.removeEventListener("storage", handleStorage);
  };
}
