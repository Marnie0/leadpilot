-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "isDemoTemplate" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "organizations_expiresAt_idx" ON "organizations"("expiresAt");
