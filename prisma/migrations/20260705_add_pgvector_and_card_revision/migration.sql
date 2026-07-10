-- AlterTable
ALTER TABLE "KnowledgeQuestion" ADD COLUMN "trace" TEXT;

-- AlterTable
ALTER TABLE "KnowledgeAnswer" ADD COLUMN "answerMode" TEXT NOT NULL DEFAULT 'FALLBACK';

-- CreateTable: KnowledgeCardRevision
CREATE TABLE "KnowledgeCardRevision" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeCardRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeCardRevision_cardId_idx" ON "KnowledgeCardRevision"("cardId");
CREATE INDEX "KnowledgeCardRevision_createdAt_idx" ON "KnowledgeCardRevision"("createdAt");

-- AddForeignKey
ALTER TABLE "KnowledgeCardRevision" ADD CONSTRAINT "KnowledgeCardRevision_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "KnowledgeCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
