const KNOWLEDGE_ASK_SCROLL_Y_KEY = "nju-knowledge-ask-scroll-y";

export function saveKnowledgeAskScrollPosition() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      KNOWLEDGE_ASK_SCROLL_Y_KEY,
      String(window.scrollY)
    );
  } catch {
    // Best-effort only; navigation should continue even if storage is blocked.
  }
}

export function restoreKnowledgeAskScrollPosition() {
  if (typeof window === "undefined") return;

  try {
    const raw = window.sessionStorage.getItem(KNOWLEDGE_ASK_SCROLL_Y_KEY);
    if (!raw) return;

    const top = Number.parseInt(raw, 10);
    if (Number.isNaN(top)) return;

    window.sessionStorage.removeItem(KNOWLEDGE_ASK_SCROLL_Y_KEY);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top, behavior: "auto" });
      });
    });
  } catch {
    // Best-effort only; a failed restore should not break the page.
  }
}
