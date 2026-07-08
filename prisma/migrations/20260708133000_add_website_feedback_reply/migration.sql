ALTER TABLE "WebsiteFeedback"
ADD COLUMN "replyContent" TEXT,
ADD COLUMN "repliedAt" TIMESTAMP(3),
ADD COLUMN "repliedById" TEXT;

CREATE INDEX "WebsiteFeedback_repliedById_idx" ON "WebsiteFeedback"("repliedById");

ALTER TABLE "WebsiteFeedback"
ADD CONSTRAINT "WebsiteFeedback_repliedById_fkey"
FOREIGN KEY ("repliedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
