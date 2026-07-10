export type PostContentFormat = "plain" | "markdown";

const MARKDOWN_CONTENT_MARKER = "<!-- nju-forum:format=markdown -->";

export function normalizePostContentFormat(value: unknown): PostContentFormat {
  return value === "markdown" ? "markdown" : "plain";
}

export function getStoredPostContentFormat(content: string): PostContentFormat {
  return content.trimStart().startsWith(MARKDOWN_CONTENT_MARKER)
    ? "markdown"
    : "plain";
}

export function stripPostContentMarker(content: string) {
  const trimmedStart = content.trimStart();
  if (!trimmedStart.startsWith(MARKDOWN_CONTENT_MARKER)) return content;

  return trimmedStart.slice(MARKDOWN_CONTENT_MARKER.length).replace(/^\r?\n/, "");
}

export function encodePostContent(content: string, format: PostContentFormat) {
  const cleanContent = stripPostContentMarker(content).trim();
  if (format !== "markdown") return cleanContent;

  return `${MARKDOWN_CONTENT_MARKER}\n${cleanContent}`;
}
