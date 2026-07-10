ALTER TABLE "KnowledgeCard" ADD COLUMN "verifiedAt" TIMESTAMP(3);

UPDATE "KnowledgeCard"
SET "verifiedAt" = "updatedAt"
WHERE "verificationStatus" = 'VERIFIED'
  AND "verifiedAt" IS NULL;

CREATE INDEX "KnowledgeCard_verifiedAt_idx" ON "KnowledgeCard"("verifiedAt");
