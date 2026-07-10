CREATE TABLE "KnowledgeConversation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),

  CONSTRAINT "KnowledgeConversation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "KnowledgeQuestion"
  ADD COLUMN "conversationId" TEXT,
  ADD COLUMN "turnIndex" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "KnowledgeConversation_createdAt_idx" ON "KnowledgeConversation"("createdAt");
CREATE INDEX "KnowledgeConversation_isActive_idx" ON "KnowledgeConversation"("isActive");
CREATE INDEX "KnowledgeConversation_userId_idx" ON "KnowledgeConversation"("userId");
CREATE INDEX "KnowledgeQuestion_conversationId_turnIndex_idx" ON "KnowledgeQuestion"("conversationId", "turnIndex");

ALTER TABLE "KnowledgeConversation"
  ADD CONSTRAINT "KnowledgeConversation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeQuestion"
  ADD CONSTRAINT "KnowledgeQuestion_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "KnowledgeConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
