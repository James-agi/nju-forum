-- CreateTable
CREATE TABLE "KnowledgeAnswerFeedback" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeAnswerFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeAnswerFeedback_questionId_idx" ON "KnowledgeAnswerFeedback"("questionId");

-- CreateIndex
CREATE INDEX "KnowledgeAnswerFeedback_userId_idx" ON "KnowledgeAnswerFeedback"("userId");

-- CreateIndex
CREATE INDEX "KnowledgeAnswerFeedback_createdAt_idx" ON "KnowledgeAnswerFeedback"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeAnswerFeedback_questionId_userId_key" ON "KnowledgeAnswerFeedback"("questionId", "userId");

-- AddForeignKey
ALTER TABLE "KnowledgeAnswerFeedback" ADD CONSTRAINT "KnowledgeAnswerFeedback_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "KnowledgeQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeAnswerFeedback" ADD CONSTRAINT "KnowledgeAnswerFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
