ALTER TABLE "Post"
  ADD COLUMN IF NOT EXISTS "favoriteCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastReplyAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "hotScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "activeScore" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "Post"
SET
  "favoriteCount" = COALESCE(favorites.count, 0),
  "replyCount" = COALESCE(replies.count, 0),
  "lastReplyAt" = replies."lastReplyAt"
FROM (
  SELECT "postId", COUNT(*)::int AS count
  FROM "Favorite"
  GROUP BY "postId"
) favorites
FULL OUTER JOIN (
  SELECT "postId", COUNT(*)::int AS count, MAX("createdAt") AS "lastReplyAt"
  FROM "Reply"
  GROUP BY "postId"
) replies
ON favorites."postId" = replies."postId"
WHERE "Post"."id" = COALESCE(favorites."postId", replies."postId");

UPDATE "Post"
SET
  "hotScore" =
    "favoriteCount" * 3
    + "replyCount" * 2
    + LN("viewCount" + 1)
    + CASE
        WHEN "createdAt" > NOW() - INTERVAL '7 days' THEN 10
        ELSE 0
      END,
  "activeScore" =
    CASE
      WHEN "lastReplyAt" IS NULL THEN 0
      ELSE
        "replyCount" * 4
        + "favoriteCount" * 2
        + LN("viewCount" + 1)
        + GREATEST(0, 7 - EXTRACT(EPOCH FROM (NOW() - "lastReplyAt")) / 86400)
    END;

CREATE INDEX IF NOT EXISTS "Post_pinned_createdAt_id_idx"
  ON "Post"("pinned", "createdAt", "id");

CREATE INDEX IF NOT EXISTS "Post_sectionId_pinned_createdAt_id_idx"
  ON "Post"("sectionId", "pinned", "createdAt", "id");

CREATE INDEX IF NOT EXISTS "Post_hotScore_createdAt_id_idx"
  ON "Post"("hotScore", "createdAt", "id");

CREATE INDEX IF NOT EXISTS "Post_activeScore_lastReplyAt_id_idx"
  ON "Post"("activeScore", "lastReplyAt", "id");

CREATE INDEX IF NOT EXISTS "Reply_createdAt_idx"
  ON "Reply"("createdAt");

CREATE INDEX IF NOT EXISTS "Reply_postId_createdAt_id_idx"
  ON "Reply"("postId", "createdAt", "id");
