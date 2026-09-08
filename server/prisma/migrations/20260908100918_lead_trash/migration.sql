-- DropIndex
DROP INDEX "leads_organizationId_archivedAt_updatedAt_idx";

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- CreateIndex
CREATE INDEX "leads_organizationId_deletedAt_archivedAt_updatedAt_idx" ON "leads"("organizationId", "deletedAt", "archivedAt", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "leads_deletedAt_idx" ON "leads"("deletedAt");
