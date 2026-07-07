-- CreateEnum
CREATE TYPE "ContributionType" AS ENUM ('CITED', 'MATERIAL', 'QUALITY_POST', 'OTHER');

-- CreateTable
CREATE TABLE "WebsiteFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "WebsiteFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributionEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "type" "ContributionType" NOT NULL DEFAULT 'OTHER',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebsiteFeedback_userId_idx" ON "WebsiteFeedback"("userId");

-- CreateIndex
CREATE INDEX "WebsiteFeedback_createdAt_idx" ON "WebsiteFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "WebsiteFeedback_archivedAt_idx" ON "WebsiteFeedback"("archivedAt");

-- CreateIndex
CREATE INDEX "ContributionEvent_userId_idx" ON "ContributionEvent"("userId");

-- CreateIndex
CREATE INDEX "ContributionEvent_createdAt_idx" ON "ContributionEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "WebsiteFeedback" ADD CONSTRAINT "WebsiteFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionEvent" ADD CONSTRAINT "ContributionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionEvent" ADD CONSTRAINT "ContributionEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

