import { getPostTextPreview } from "@/lib/forum/post-preview";

const GUEST_PREVIEW_LINES = 3;

export function getVisiblePost<
  T extends { content: string; images: string[] },
>(post: T, canReadFullContent: boolean) {
  if (canReadFullContent) {
    return { ...post, contentRestricted: false };
  }

  return {
    ...post,
    content: getPostTextPreview(post.content, GUEST_PREVIEW_LINES),
    images: [],
    contentRestricted: true,
  };
}
