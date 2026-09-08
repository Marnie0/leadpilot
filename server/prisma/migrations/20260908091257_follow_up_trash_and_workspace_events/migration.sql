-- CreateEnum
CREATE TYPE "WorkspaceEventType" AS ENUM ('CURRENCY_CHANGED');

-- DropIndex
DROP INDEX "follow_ups_assignedToId_status_dueAt_idx";

-- DropIndex
DROP INDEX "follow_ups_leadId_status_dueAt_idx";

-- DropIndex
DROP INDEX "follow_ups_organizationId_status_dueAt_idx";

-- AlterTable
ALTER TABLE "follow_ups" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "workspace_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "WorkspaceEventType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_events_organizationId_createdAt_idx" ON "workspace_events"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "follow_ups_organizationId_deletedAt_status_dueAt_idx" ON "follow_ups"("organizationId", "deletedAt", "status", "dueAt");

-- CreateIndex
CREATE INDEX "follow_ups_leadId_deletedAt_status_dueAt_idx" ON "follow_ups"("leadId", "deletedAt", "status", "dueAt");

-- CreateIndex
CREATE INDEX "follow_ups_assignedToId_deletedAt_status_dueAt_idx" ON "follow_ups"("assignedToId", "deletedAt", "status", "dueAt");

-- CreateIndex
CREATE INDEX "follow_ups_deletedAt_idx" ON "follow_ups"("deletedAt");

-- AddForeignKey
ALTER TABLE "workspace_events" ADD CONSTRAINT "workspace_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_events" ADD CONSTRAINT "workspace_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
