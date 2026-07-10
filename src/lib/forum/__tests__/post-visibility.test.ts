import { describe, expect, it } from "vitest";
import { getVisiblePost } from "@/lib/forum/post-visibility";

describe("getVisiblePost", () => {
  const post = {
    id: "post-1",
    content: [
      "<!-- nju-forum:format=markdown -->",
      "# First line",
      "Second line",
      "![private image](/forum-images/private.png)",
      "Third line",
      "Fourth line must stay private",
    ].join("\n"),
    images: ["/forum-images/private.png"],
  };

  it("returns complete content to an authenticated user", () => {
    expect(getVisiblePost(post, true)).toEqual({
      ...post,
      contentRestricted: false,
    });
  });

  it("returns only the public preview to a guest", () => {
    expect(getVisiblePost(post, false)).toEqual({
      id: "post-1",
      content: "First line\nSecond line\nThird line",
      images: [],
      contentRestricted: true,
    });
  });
});
