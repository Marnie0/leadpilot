-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedById" TEXT;

-- CreateIndex
CREATE INDEX "leads_organizationId_archivedAt_updatedAt_idx" ON "leads"("organizationId", "archivedAt", "updatedAt" DESC);
