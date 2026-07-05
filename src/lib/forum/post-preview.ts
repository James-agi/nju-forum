import { stripPostContentMarker } from "@/lib/forum/content-format";

const MARKDOWN_IMAGE_PATTERN =
  /^!\[([^\]\n]*)\]\((\/forum-images\/[A-Za-z0-9._~/%-]+|\/knowledge-images\/[A-Za-z0-9._~/%-]+)\)$/;

export function getPostTextPreview(content: string, maxLines = 4) {
  return stripPostContentMarker(content)
    .split(/\r?\n/)
    .filter((line) => !line.trim().match(MARKDOWN_IMAGE_PATTERN))
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, "")
        .replace(/^\s*[-*]\s+/, "")
        .replace(/^\s*\d+[.)]\s+/, "")
        .replace(/^\s*>\s?/, "")
        .replace(/\[([^\]\n]+)\]\(([^)]+)\)/g, "$1")
        .replace(/(\*\*|__)([^*_][\s\S]*?)\1/g, "$2")
        .replace(/`([^`\n]+)`/g, "$1")
    )
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxLines)
    .join("\n");
}
