-- CreateEnum
CREATE TYPE "GapType" AS ENUM ('CONTENT', 'DATA', 'ACTION', 'POLICY_UNCLEAR');

-- AlterTable
ALTER TABLE "KnowledgeGap" ADD COLUMN     "gapType" "GapType" NOT NULL DEFAULT 'CONTENT';

-- CreateIndex
CREATE INDEX "KnowledgeGap_gapType_idx" ON "KnowledgeGap"("gapType");
