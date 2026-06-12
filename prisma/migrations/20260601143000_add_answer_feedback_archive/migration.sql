-- AlterTable
ALTER TABLE "KnowledgeAnswerFeedback" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "KnowledgeAnswerFeedback_archivedAt_idx" ON "KnowledgeAnswerFeedback"("archivedAt");
