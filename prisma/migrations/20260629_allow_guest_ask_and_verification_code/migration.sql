ALTER TABLE "KnowledgeQuestion"
  ALTER COLUMN "askerId" DROP NOT NULL;

ALTER TABLE "KnowledgeQuestion"
  DROP CONSTRAINT "KnowledgeQuestion_askerId_fkey",
  ADD CONSTRAINT "KnowledgeQuestion_askerId_fkey"
  FOREIGN KEY ("askerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "VerificationCode" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VerificationCode_email_idx" ON "VerificationCode"("email");
CREATE INDEX "VerificationCode_createdAt_idx" ON "VerificationCode"("createdAt");
